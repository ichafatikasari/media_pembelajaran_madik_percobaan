import { TingkatSoal } from '../data/types';
import { buatId } from '../utils/id';
import { normalisasiBarisMentah, normalisasiTeksBiasa } from './normalizer';
import {
  DraftSoal,
  HasilValidasiDraft,
  SumberImpor,
  validasiDaftarDraftSoal,
} from './validator';

export const PENANDA_TEKS_BENAR = '[[TANDABENAR]]';

const REGEX_NOMOR_SOAL = /^\s*(?:(?:no\.?|soal)\s*(\d{1,3})\s*[.)\-:]?|(\d{1,3})\s*[.)\-:])\s+(.*)$/i;
const REGEX_PILIHAN = /^\s*(\*?\s*\(?([A-Da-d])\s*[.)]\s*\*?|\*\s*([A-Da-d])\s*[.)]?)\s*(.+)$/;
const REGEX_KUNCI_BARIS = /^\s*(?:kunci(?:\s*jawaban)?|jawaban(?:\s*benar)?)\s*[:=\-]\s*(.+)$/i;
const REGEX_PENJELASAN = /^\s*(?:penjelasan|pembahasan)\s*[:=\-]\s*(.*)$/i;
const REGEX_TINGKAT = /^\s*(?:tingkat|level|kesulitan)\s*[:=\-]\s*(.+)$/i;
const REGEX_TOPIK = /^\s*(?:topik|materi|bab|mapel)\s*[:=\-]\s*(.+)$/i;
const REGEX_BONUS = /^\s*bonus\s*[:=\-]\s*(.+)$/i;

function parseTingkat(nilai: string): TingkatSoal | undefined {
  const bersih = nilai.trim().toLowerCase();
  if (bersih.startsWith('mudah')) return 'Mudah';
  if (bersih.startsWith('sedang')) return 'Sedang';
  if (bersih.startsWith('sulit') || bersih.startsWith('sukar')) return 'Sulit';
  return undefined;
}

function parseBonus(nilai: string): boolean {
  const bersih = nilai.trim().toLowerCase();
  return ['ya', 'iya', 'yes', 'true', '1', 'bonus'].includes(bersih);
}

function bersihkanPenandaPilihan(teksAwal: string): {
  teks: string;
  ditandaiBenar: boolean;
} {
  let teks = teksAwal;
  let ditandaiBenar = false;

  if (teks.includes(PENANDA_TEKS_BENAR)) {
    ditandaiBenar = true;
    teks = teks.replaceAll(PENANDA_TEKS_BENAR, '');
  }

  if (
    /^\*/.test(teks.trim()) ||
    /\*\s*$/.test(teks.trim()) ||
    /\(\s*benar\s*\)|\[\s*benar\s*\]|[✓✔]/i.test(teks)
  ) {
    ditandaiBenar = true;
    teks = teks
      .replace(/^\s*\*\s*/, '')
      .replace(/\s*\*\s*$/, '')
      .replace(/\(\s*benar\s*\)|\[\s*benar\s*\]/gi, '')
      .replace(/[✓✔]/g, '');
  }

  return {
    teks: normalisasiTeksBiasa(teks),
    ditandaiBenar,
  };
}

function terjemahkanKunci(nilaiMentah: string, pilihan: string[]): number | null {
  const bersih = normalisasiTeksBiasa(nilaiMentah);
  if (!bersih) return null;

  const hurufMatch = bersih.match(/^([A-Da-d])(?:[.)\s]|$)/);
  if (hurufMatch) {
    return hurufMatch[1].toUpperCase().charCodeAt(0) - 65;
  }

  const angkaMatch = bersih.match(/^([1-4])(?:[.)\s]|$)/);
  if (angkaMatch) {
    return Number(angkaMatch[1]) - 1;
  }

  const cocokTeks = pilihan.findIndex(
    (p) => p.trim().toLowerCase() === bersih.toLowerCase()
  );
  if (cocokTeks >= 0) {
    return cocokTeks;
  }

  return null;
}

/**
 * Membaca blok daftar kunci di akhir dokumen seperti:
 * "1. B  2. C  3. A" atau "1-B, 2-C" atau baris terpisah.
 */
function ekstrakDaftarKunciAkhir(teks: string): {
  teksTanpaDaftarKunci: string;
  petaKunciNomor: Map<number, number>;
} {
  const baris = normalisasiBarisMentah(teks).split('\n');
  const petaKunciNomor = new Map<number, number>();

  let indeksMulaiKunci = -1;
  for (let i = baris.length - 1; i >= 0; i -= 1) {
    const b = baris[i].trim();
    if (!b) continue;

    if (/^(?:kunci\s*jawaban|daftar\s*kunci|kunci)\s*[:\-]?$/i.test(b)) {
      indeksMulaiKunci = i;
      break;
    }

    // Jika baris hanya berisi pasangan nomor-huruf (mis. "1. B 2. C" atau "1-A, 2-D")
    const pasangan = [...b.matchAll(/(?:^|[\s,;])(\d{1,3})\s*[.\-:)]\s*([A-Da-d])(?=$|[\s,;.)])/g)];
    const sisa = b
      .replace(/(?:kunci(?:\s*jawaban)?\s*[:\-]?)/gi, '')
      .replace(/(\d{1,3})\s*[.\-:)]\s*([A-Da-d])/g, '')
      .replace(/[\s,;.\-]/g, '');

    if (pasangan.length >= 1 && sisa.length === 0) {
      indeksMulaiKunci = i;
      for (const m of pasangan) {
        petaKunciNomor.set(Number(m[1]), m[2].toUpperCase().charCodeAt(0) - 65);
      }
      continue;
    }

    break;
  }

  if (indeksMulaiKunci === -1) {
    return { teksTanpaDaftarKunci: teks, petaKunciNomor };
  }

  // Ekstrak seluruh pasangan kunci mulai dari indeksMulaiKunci ke bawah
  petaKunciNomor.clear();
  const bagianKunci = baris.slice(indeksMulaiKunci).join('\n');
  const semuaPasangan = [
    ...bagianKunci.matchAll(/(?:^|[\s,;])(\d{1,3})\s*[.\-:)]\s*([A-Da-d])(?=$|[\s,;.)])/gm),
  ];
  for (const m of semuaPasangan) {
    petaKunciNomor.set(Number(m[1]), m[2].toUpperCase().charCodeAt(0) - 65);
  }

  if (petaKunciNomor.size === 0) {
    return { teksTanpaDaftarKunci: teks, petaKunciNomor };
  }

  return {
    teksTanpaDaftarKunci: baris.slice(0, indeksMulaiKunci).join('\n'),
    petaKunciNomor,
  };
}

interface AkumulatorSoal {
  nomorSoal?: number;
  barisPertanyaan: string[];
  barisKode: string[];
  pilihan: string[];
  kunciMentah?: string;
  kunciDariTanda?: number;
  barisPenjelasan: string[];
  tingkat?: TingkatSoal;
  topik?: string;
  bonus?: boolean;
  sedangDiField: 'pertanyaan' | 'pilihan' | 'penjelasan';
}

function buatAkumulatorKosong(): AkumulatorSoal {
  return {
    barisPertanyaan: [],
    barisKode: [],
    pilihan: [],
    barisPenjelasan: [],
    sedangDiField: 'pertanyaan',
  };
}

export function parseTeksSoal(
  teksMentah: string,
  sumber: SumberImpor = 'teks',
  peringatanTambahan: string[] = []
): HasilValidasiDraft {
  const { teksTanpaDaftarKunci, petaKunciNomor } = ekstrakDaftarKunciAkhir(teksMentah);
  const barisList = normalisasiBarisMentah(teksTanpaDaftarKunci).split('\n');

  const hasilAkumulator: AkumulatorSoal[] = [];
  let aktif: AkumulatorSoal | null = null;
  let dalamBlokBacktick = false;

  const selesaikanAktif = () => {
    if (!aktif) return;
    if (
      aktif.barisPertanyaan.length > 0 ||
      aktif.pilihan.length > 0 ||
      aktif.barisKode.length > 0
    ) {
      hasilAkumulator.push(aktif);
    }
    aktif = null;
  };

  for (let i = 0; i < barisList.length; i += 1) {
    const barisAsli = barisList[i];
    const barisTrim = barisAsli.trim();

    // Penanganan blok kode ``` ... ``` tanpa mengubah indentasi atau spasi kode
    if (barisTrim.startsWith('```')) {
      if (!aktif) {
        aktif = buatAkumulatorKosong();
      }
      dalamBlokBacktick = !dalamBlokBacktick;
      continue;
    }

    if (dalamBlokBacktick) {
      if (!aktif) {
        aktif = buatAkumulatorKosong();
      }
      aktif.barisKode.push(barisAsli);
      continue;
    }

    // Baris berindentasi 4 spasi atau tab saat masih di pertanyaan -> simpan sebagai blok kode
    if (
      aktif &&
      aktif.sedangDiField === 'pertanyaan' &&
      /^(?: {4}|\t)/.test(barisAsli) &&
      barisTrim.length > 0 &&
      !REGEX_PILIHAN.test(barisAsli) &&
      !REGEX_NOMOR_SOAL.test(barisAsli)
    ) {
      aktif.barisKode.push(barisAsli.replace(/^(?: {4}|\t)/, ''));
      continue;
    }

    if (!barisTrim) {
      continue;
    }

    // Cek nomor soal baru
    const cocokNomor = barisAsli.match(REGEX_NOMOR_SOAL);
    if (cocokNomor) {
      selesaikanAktif();
      aktif = buatAkumulatorKosong();
      aktif.nomorSoal = Number(cocokNomor[1] || cocokNomor[2]);
      if (cocokNomor[3]?.trim()) {
        aktif.barisPertanyaan.push(normalisasiTeksBiasa(cocokNomor[3]));
      }
      continue;
    }

    // Jika belum ada soal aktif dan baris bukan metadata, mulai soal baru implisit
    if (!aktif) {
      aktif = buatAkumulatorKosong();
    }

    // Cek baris kunci: "Kunci: B", "Jawaban: B", "Kunci Jawaban: B"
    const cocokKunci = barisAsli.match(REGEX_KUNCI_BARIS);
    if (cocokKunci) {
      aktif.kunciMentah = cocokKunci[1].trim();
      continue;
    }

    // Cek metadata opsional
    const cocokPenjelasan = barisAsli.match(REGEX_PENJELASAN);
    if (cocokPenjelasan) {
      if (cocokPenjelasan[1]?.trim()) {
        aktif.barisPenjelasan.push(normalisasiTeksBiasa(cocokPenjelasan[1]));
      }
      aktif.sedangDiField = 'penjelasan';
      continue;
    }

    const cocokTingkat = barisAsli.match(REGEX_TINGKAT);
    if (cocokTingkat) {
      aktif.tingkat = parseTingkat(cocokTingkat[1]);
      continue;
    }

    const cocokTopik = barisAsli.match(REGEX_TOPIK);
    if (cocokTopik) {
      aktif.topik = normalisasiTeksBiasa(cocokTopik[1]);
      continue;
    }

    const cocokBonus = barisAsli.match(REGEX_BONUS);
    if (cocokBonus) {
      aktif.bonus = parseBonus(cocokBonus[1]);
      continue;
    }

    // Cek pilihan A-D
    const cocokPilihan = barisAsli.match(REGEX_PILIHAN);
    if (cocokPilihan && aktif.barisPertanyaan.length > 0) {
      const huruf = (cocokPilihan[2] || cocokPilihan[3] || '').toUpperCase();
      const indeksPilihan = huruf ? huruf.charCodeAt(0) - 65 : aktif.pilihan.length;
      const awalanBintang = /\*/.test(cocokPilihan[1] || '');
      const { teks, ditandaiBenar } = bersihkanPenandaPilihan(cocokPilihan[4]);

      while (aktif.pilihan.length < indeksPilihan) {
        aktif.pilihan.push('');
      }
      aktif.pilihan[indeksPilihan] = teks;
      if (awalanBintang || ditandaiBenar) {
        aktif.kunciDariTanda = indeksPilihan;
      }
      aktif.sedangDiField = 'pilihan';
      continue;
    }

    // Baris lanjutan untuk field yang sedang aktif
    if (aktif.sedangDiField === 'pilihan' && aktif.pilihan.length > 0) {
      const idxTerakhir = aktif.pilihan.length - 1;
      const { teks, ditandaiBenar } = bersihkanPenandaPilihan(barisTrim);
      aktif.pilihan[idxTerakhir] = normalisasiTeksBiasa(`${aktif.pilihan[idxTerakhir]} ${teks}`);
      if (ditandaiBenar) {
        aktif.kunciDariTanda = idxTerakhir;
      }
    } else if (aktif.sedangDiField === 'penjelasan') {
      aktif.barisPenjelasan.push(normalisasiTeksBiasa(barisTrim));
    } else {
      aktif.barisPertanyaan.push(normalisasiTeksBiasa(barisTrim));
    }
  }

  selesaikanAktif();

  const daftarDraft: DraftSoal[] = hasilAkumulator.map((item, idx) => {
    const pertanyaan = normalisasiTeksBiasa(item.barisPertanyaan.join(' '));
    const pilihan = item.pilihan.slice(0, 4);

    let kunci: number | null = null;
    if (item.kunciMentah) {
      kunci = terjemahkanKunci(item.kunciMentah, pilihan);
    } else if (item.kunciDariTanda !== undefined) {
      kunci = item.kunciDariTanda;
    } else if (item.nomorSoal !== undefined && petaKunciNomor.has(item.nomorSoal)) {
      kunci = petaKunciNomor.get(item.nomorSoal) ?? null;
    } else if (petaKunciNomor.has(idx + 1)) {
      kunci = petaKunciNomor.get(idx + 1) ?? null;
    }

    const kode = item.barisKode.length > 0 ? item.barisKode.join('\n') : undefined;
    const penjelasan =
      item.barisPenjelasan.length > 0
        ? normalisasiTeksBiasa(item.barisPenjelasan.join(' '))
        : undefined;

    return {
      id: buatId('soal'),
      pertanyaan,
      ...(kode !== undefined ? { kode } : {}),
      pilihan,
      kunci,
      ...(penjelasan !== undefined ? { penjelasan } : {}),
      ...(item.tingkat !== undefined ? { tingkat: item.tingkat } : {}),
      ...(item.topik ? { topik: item.topik } : {}),
      ...(item.bonus ? { bonus: true } : {}),
      sumber,
      masalah: [],
      peringatanDetail: [],
    };
  });

  return validasiDaftarDraftSoal(daftarDraft, peringatanTambahan);
}
