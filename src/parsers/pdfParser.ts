import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parseTeksSoal } from './textParser';
import { HasilValidasiDraft, validasiDaftarDraftSoal } from './validator';

if (typeof (Promise as unknown as { try?: unknown }).try !== 'function') {
  (Promise as unknown as { try: <T>(fn: (...args: unknown[]) => T, ...args: unknown[]) => Promise<T> }).try = (
    fn,
    ...args
  ) =>
    new Promise((resolve) => {
      resolve(fn(...args));
    });
}

if (typeof (Uint8Array.prototype as unknown as { toHex?: unknown }).toHex !== 'function') {
  (Uint8Array.prototype as unknown as { toHex: (this: Uint8Array) => string }).toHex = function () {
    let hex = '';
    for (let i = 0; i < this.length; i += 1) {
      hex += this[i].toString(16).padStart(2, '0');
    }
    return hex;
  };
}

interface ItemTeksPdf {
  teks: string;
  x: number;
  y: number;
}

function susunBarisDariItemPdf(items: ItemTeksPdf[]): {
  teksHalaman: string;
  indikasiDuaKolom: boolean;
} {
  if (items.length === 0) {
    return { teksHalaman: '', indikasiDuaKolom: false };
  }

  // Urutkan dari atas ke bawah (y terbesar dulu pada koordinat PDF), lalu kiri ke kanan (x terkecil)
  const terurut = [...items].sort((a, b) => {
    if (Math.abs(a.y - b.y) > 4) {
      return b.y - a.y;
    }
    return a.x - b.x;
  });

  const barisKelompok: ItemTeksPdf[][] = [];
  for (const item of terurut) {
    const barisTerakhir = barisKelompok[barisKelompok.length - 1];
    if (!barisTerakhir || Math.abs(barisTerakhir[0].y - item.y) > 4.5) {
      barisKelompok.push([item]);
    } else {
      barisTerakhir.push(item);
    }
  }

  let jumlahCelahLebar = 0;
  const teksBaris: string[] = [];

  for (const baris of barisKelompok) {
    baris.sort((a, b) => a.x - b.x);
    let gabungan = '';
    for (let i = 0; i < baris.length; i += 1) {
      const cur = baris[i];
      if (i > 0) {
        const prev = baris[i - 1];
        const jarakX = cur.x - prev.x;
        if (jarakX > 180) {
          jumlahCelahLebar += 1;
        }
        if (!gabungan.endsWith(' ') && !cur.teks.startsWith(' ')) {
          gabungan += ' ';
        }
      }
      gabungan += cur.teks;
    }
    const bersih = gabungan.trim();
    if (bersih) {
      teksBaris.push(bersih);
    }
  }

  return {
    teksHalaman: teksBaris.join('\n'),
    indikasiDuaKolom: jumlahCelahLebar >= 4,
  };
}

export async function parsePdfBuffer(buffer: ArrayBuffer): Promise<HasilValidasiDraft> {
  if (typeof pdfWorkerUrl === 'string' && pdfWorkerUrl) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  }
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    verbosity: 0,
  });
  const pdf = await loadingTask.promise;

  const halamanTeks: string[] = [];
  let totalKarakter = 0;
  let indikasiDuaKolom = false;

  for (let nomorHal = 1; nomorHal <= pdf.numPages; nomorHal += 1) {
    const halaman = await pdf.getPage(nomorHal);
    const konten = await halaman.getTextContent();
    const itemTeks: ItemTeksPdf[] = [];

    for (const raw of konten.items) {
      if ('str' in raw && typeof raw.str === 'string') {
        const teks = raw.str;
        if (teks.trim().length > 0) {
          const transform = raw.transform;
          itemTeks.push({
            teks,
            x: Array.isArray(transform) ? Number(transform[4] ?? 0) : 0,
            y: Array.isArray(transform) ? Number(transform[5] ?? 0) : 0,
          });
          totalKarakter += teks.trim().length;
        }
      }
    }

    const susunan = susunBarisDariItemPdf(itemTeks);
    if (susunan.indikasiDuaKolom) {
      indikasiDuaKolom = true;
    }
    if (susunan.teksHalaman) {
      halamanTeks.push(susunan.teksHalaman);
    }
  }

  // Deteksi PDF hasil scan (gambar tanpa lapisan teks)
  if (totalKarakter < 15) {
    return validasiDaftarDraftSoal(
      [],
      [
        'PDF ini tampak seperti hasil scan/gambar dan tidak memiliki lapisan teks yang dapat dibaca secara offline. Saran: salin teks soal lalu gunakan tab Tempel Teks, atau ubah soal ke format Word (.docx) / Excel (.xlsx).',
      ]
    );
  }

  const peringatan: string[] = [];
  if (indikasiDuaKolom) {
    peringatan.push(
      'Tata letak PDF tampak memiliki lebih dari satu kolom. Mohon periksa kembali urutan soal dan pilihan pada tabel pratinjau.'
    );
  }

  const teksGabungan = halamanTeks.join('\n');
  return parseTeksSoal(teksGabungan, 'pdf', peringatan);
}
