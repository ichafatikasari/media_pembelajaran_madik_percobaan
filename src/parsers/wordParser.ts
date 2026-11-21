import JSZip from 'jszip';
import mammoth from 'mammoth';
import { PENANDA_TEKS_BENAR, parseTeksSoal } from './textParser';
import { HasilValidasiDraft } from './validator';

const REGEX_AWALAN_OPSI = /^\s*(\(?[A-Da-d]\s*[.)])\s*(.+)$/;

function gabungPenandaParagrafDariXml(xmlText: string): Set<string> {
  const ditandai = new Set<string>();
  try {
    if (typeof DOMParser === 'undefined') {
      return ditandai;
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    const paragrafList = doc.getElementsByTagName('w:p');

    for (let i = 0; i < paragrafList.length; i += 1) {
      const p = paragrafList[i];
      const teksUtuh = p.textContent?.trim() ?? '';
      if (!REGEX_AWALAN_OPSI.test(teksUtuh)) {
        continue;
      }

      const runs = p.getElementsByTagName('w:r');
      let totalKarakter = 0;
      let karakterTerformat = 0;

      for (let j = 0; j < runs.length; j += 1) {
        const run = runs[j];
        const teksRun = run.textContent ?? '';
        const panjang = teksRun.replace(/^\s*\(?[A-Da-d]\s*[.)]\s*/, '').trim().length;
        if (panjang === 0) continue;

        totalKarakter += panjang;
        const rPr = run.getElementsByTagName('w:rPr')[0];
        if (!rPr) continue;

        const adaHighlight = rPr.getElementsByTagName('w:highlight').length > 0;
        const shd = rPr.getElementsByTagName('w:shd')[0];
        const shdFill = shd?.getAttribute('w:fill');
        const adaShading = Boolean(shdFill && shdFill.toLowerCase() !== 'auto' && shdFill.toLowerCase() !== 'ffffff');
        const uEl = rPr.getElementsByTagName('w:u')[0];
        const adaUnderline = Boolean(uEl && uEl.getAttribute('w:val') !== 'none');
        const bEl = rPr.getElementsByTagName('w:b')[0];
        const adaBold = Boolean(bEl && bEl.getAttribute('w:val') !== '0' && bEl.getAttribute('w:val') !== 'false');

        if (adaHighlight || adaShading || adaUnderline || adaBold) {
          karakterTerformat += panjang;
        }
      }

      if (totalKarakter > 0 && karakterTerformat / totalKarakter >= 0.6) {
        ditandai.add(teksUtuh.replace(/\s+/g, ' ').trim());
      }
    }
  } catch {
    // Jika parsing XML gagal, pemrosesan HTML mammoth tetap berjalan
  }
  return ditandai;
}

function cekElemenMemilikiFormatKunci(el: Element, setXmlTerformat: Set<string>): boolean {
  const teks = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (!teks) return false;

  if (setXmlTerformat.has(teks)) {
    return true;
  }

  // Cek apakah mayoritas teks opsi berada di dalam <strong>, <b>, <u>, atau <mark>
  const tanpaAwalan = teks.replace(/^\s*\(?[A-Da-d]\s*[.)]\s*/, '').trim();
  if (!tanpaAwalan) return false;

  const elemenFormat = [
    ...Array.from(el.getElementsByTagName('strong')),
    ...Array.from(el.getElementsByTagName('b')),
    ...Array.from(el.getElementsByTagName('u')),
    ...Array.from(el.getElementsByTagName('mark')),
  ];
  let panjangFormat = 0;
  elemenFormat.forEach((node) => {
    const t = (node.textContent ?? '').replace(/^\s*\(?[A-Da-d]\s*[.)]\s*/, '').trim();
    panjangFormat += t.length;
  });

  return panjangFormat >= tanpaAwalan.length * 0.6;
}

function kumpulkanBlokDariRoot(root: Element): Element[] {
  const hasil: Element[] = [];
  const telusuri = (node: Element) => {
    const tag = node.tagName.toUpperCase();
    if (tag === 'P' || tag === 'LI' || tag === 'PRE' || tag === 'TR') {
      hasil.push(node);
      return;
    }
    for (let i = 0; i < node.childNodes.length; i += 1) {
      const anak = node.childNodes[i];
      if (anak.nodeType === 1) {
        telusuri(anak as Element);
      }
    }
  };
  telusuri(root);
  return hasil;
}

function ekstrakBarisDariHtmlWord(
  html: string,
  setXmlTerformat: Set<string>
): string {
  if (typeof DOMParser === 'undefined') {
    const blokHtml = html
      .replace(/<\/(p|li|tr|div|h[1-6]|pre)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .split('\n');
    const baris = blokHtml
      .map((potongan) => {
        const adaFormatKunci = /<(strong|b|u|mark)\b[^>]*>[\s\S]*?<\/\1>/i.test(potongan);
        const teks = potongan.replace(/<[^>]+>/g, '').replace(/\u00A0/g, ' ').trim();
        if (!teks) return '';
        if (adaFormatKunci && REGEX_AWALAN_OPSI.test(teks)) {
          return `${teks} ${PENANDA_TEKS_BENAR}`;
        }
        return teks;
      })
      .filter(Boolean);
    return baris.join('\n');
  }

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.documentElement;
  if (!root) return '';

  const blokList = kumpulkanBlokDariRoot(root);
  const barisMentah: { teks: string; adalahOpsi: boolean; terformat: boolean }[] = [];

  for (const el of blokList) {
    const tag = el.tagName.toUpperCase();
    if (tag === 'TR') {
      const sel = [
        ...Array.from(el.getElementsByTagName('td')),
        ...Array.from(el.getElementsByTagName('th')),
      ].map((c) => (c.textContent ?? '').trim());
      const barisTabel = sel.filter(Boolean).join(' ');
      if (barisTabel) {
        barisMentah.push({ teks: barisTabel, adalahOpsi: false, terformat: false });
      }
      continue;
    }

    if (el.tagName === 'PRE') {
      barisMentah.push({ teks: '```', adalahOpsi: false, terformat: false });
      const kodeLines = (el.textContent ?? '').split('\n');
      for (const kl of kodeLines) {
        barisMentah.push({ teks: kl, adalahOpsi: false, terformat: false });
      }
      barisMentah.push({ teks: '```', adalahOpsi: false, terformat: false });
      continue;
    }

    const teks = (el.textContent ?? '').replace(/\u00A0/g, ' ').trim();
    if (!teks) continue;

    const adalahOpsi = REGEX_AWALAN_OPSI.test(teks);
    const terformat = adalahOpsi && cekElemenMemilikiFormatKunci(el, setXmlTerformat);
    barisMentah.push({ teks, adalahOpsi, terformat });
  }

  // Kelompokkan per blok soal agar opsi hanya ditandai jika tidak semua opsi sama-sama tebal
  const hasilBaris: string[] = [];
  let indeksMulaiOpsiGrup = -1;

  const prosesGrupOpsi = (mulai: number, akhir: number) => {
    if (mulai < 0 || akhir < mulai) return;
    const jumlahOpsi = akhir - mulai + 1;
    let jumlahTerformat = 0;
    for (let k = mulai; k <= akhir; k += 1) {
      if (barisMentah[k].terformat) jumlahTerformat += 1;
    }
    // Hanya tandai kunci jika ada 1 (atau sebagian kecil) opsi yang ditonjolkan, bukan semua opsi
    const validSebagaiPenanda = jumlahTerformat >= 1 && jumlahTerformat < jumlahOpsi;
    for (let k = mulai; k <= akhir; k += 1) {
      if (validSebagaiPenanda && barisMentah[k].terformat) {
        barisMentah[k].teks = `${barisMentah[k].teks} ${PENANDA_TEKS_BENAR}`;
      }
    }
  };

  for (let i = 0; i < barisMentah.length; i += 1) {
    if (barisMentah[i].adalahOpsi) {
      if (indeksMulaiOpsiGrup === -1) {
        indeksMulaiOpsiGrup = i;
      }
    } else if (indeksMulaiOpsiGrup !== -1) {
      prosesGrupOpsi(indeksMulaiOpsiGrup, i - 1);
      indeksMulaiOpsiGrup = -1;
    }
  }
  if (indeksMulaiOpsiGrup !== -1) {
    prosesGrupOpsi(indeksMulaiOpsiGrup, barisMentah.length - 1);
  }

  for (const item of barisMentah) {
    hasilBaris.push(item.teks);
  }

  return hasilBaris.join('\n');
}

export async function parseWordBuffer(buffer: ArrayBuffer): Promise<HasilValidasiDraft> {
  const peringatan: string[] = [];
  let setXmlTerformat = new Set<string>();

  // Langkah 1: Baca XML dokumen untuk mendeteksi bold, underline, dan highlight warna Word
  try {
    const zip = await JSZip.loadAsync(buffer);
    const fileDoc = zip.file('word/document.xml');
    if (fileDoc) {
      const xmlText = await fileDoc.async('string');
      setXmlTerformat = gabungPenandaParagrafDariXml(xmlText);
    }
  } catch {
    // Abaikan jika fallback XML gagal, lanjutkan dengan mammoth
  }

  // Langkah 2: Konversi HTML dengan styleMap mammoth untuk bold/underline/highlight
  const mammothInput =
    typeof window === 'undefined' && typeof Buffer !== 'undefined'
      ? ({ buffer: Buffer.from(buffer) } as unknown as { arrayBuffer: ArrayBuffer })
      : { arrayBuffer: buffer };

  const hasilMammoth = await mammoth.convertToHtml(mammothInput, {
    styleMap: ['b => strong', 'u => u', 'highlight => mark'],
  });

  const teksTersusun = ekstrakBarisDariHtmlWord(hasilMammoth.value, setXmlTerformat);
  if (!teksTersusun.trim()) {
    peringatan.push('Dokumen Word tidak mengandung teks soal yang terbaca.');
  }

  return parseTeksSoal(teksTersusun, 'docx', peringatan);
}
