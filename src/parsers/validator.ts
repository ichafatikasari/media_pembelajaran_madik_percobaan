import { Soal, TingkatSoal } from '../data/types';
import { acakFisherYates } from '../utils/shuffle';
import { buatId } from '../utils/id';
import { normalisasiTeksBiasa } from './normalizer';

export type SumberImpor = 'manual' | 'teks' | 'docx' | 'xlsx' | 'pdf';

export type KodeMasalahSoal =
  | 'kunci_tidak_ditemukan'
  | 'kunci_tidak_cocok'
  | 'pilihan_kurang'
  | 'pilihan_kembar'
  | 'soal_kembar'
  | 'teks_terpotong';

export interface DraftSoal {
  id: string;
  pertanyaan: string;
  kode?: string;
  pilihan: string[];
  kunci: number | null;
  penjelasan?: string;
  tingkat?: TingkatSoal;
  topik?: string;
  bonus?: boolean;
  sumber: SumberImpor;
  masalah: KodeMasalahSoal[];
  peringatanDetail: string[];
}

export interface HasilValidasiDraft {
  daftar: DraftSoal[];
  totalSoal: number;
  jumlahBermasalah: number;
  peringatanUmum: string[];
}

const LABEL_MASALAH: Record<KodeMasalahSoal, string> = {
  kunci_tidak_ditemukan: 'Kunci jawaban tidak ditemukan',
  kunci_tidak_cocok: 'Kunci tidak cocok dengan pilihan',
  pilihan_kurang: 'Pilihan jawaban kurang dari 2',
  pilihan_kembar: 'Ada pilihan jawaban yang kembar',
  soal_kembar: 'Pertanyaan kembar dengan soal lain',
  teks_terpotong: 'Teks soal atau pilihan tampak terpotong mencurigakan',
};

export function teksTerpotongMencurigakan(teks: string, apakahPertanyaan = true): boolean {
  const bersih = teks.trim();
  if (!bersih) {
    return true;
  }
  if (/\[\.{3}\]|\(\.{3}\)$/.test(bersih)) {
    return true;
  }
  if (/[,;(]$/.test(bersih)) {
    return true;
  }
  if (apakahPertanyaan) {
    if (bersih.length < 8 && !/[?=]$/.test(bersih)) {
      return true;
    }
  } else {
    if (bersih === '...' || bersih === '-' || bersih === '.') {
      return true;
    }
  }
  return false;
}

export function validasiDaftarDraftSoal(
  daftarAwal: readonly DraftSoal[],
  peringatanAwal: string[] = []
): HasilValidasiDraft {
  const hitungPertanyaan = new Map<string, number>();

  for (const item of daftarAwal) {
    const kunciTeks = normalisasiTeksBiasa(item.pertanyaan).toLowerCase();
    if (kunciTeks) {
      hitungPertanyaan.set(kunciTeks, (hitungPertanyaan.get(kunciTeks) ?? 0) + 1);
    }
  }

  let jumlahBermasalah = 0;

  const daftarTervalidasi: DraftSoal[] = daftarAwal.map((item) => {
    const masalah: KodeMasalahSoal[] = [];
    const pilihanBersih = item.pilihan.map((p) => p.trim());
    const pilihanTerisi = pilihanBersih.filter((p) => p.length > 0);

    if (pilihanTerisi.length < 2) {
      masalah.push('pilihan_kurang');
    }

    const setPilihan = new Set<string>();
    let adaKembar = false;
    for (const p of pilihanTerisi) {
      const norm = p.toLowerCase();
      if (setPilihan.has(norm)) {
        adaKembar = true;
        break;
      }
      setPilihan.add(norm);
    }
    if (adaKembar) {
      masalah.push('pilihan_kembar');
    }

    if (item.kunci === null || item.kunci === undefined || Number.isNaN(item.kunci)) {
      masalah.push('kunci_tidak_ditemukan');
    } else if (item.kunci < 0 || item.kunci >= pilihanBersih.length || !pilihanBersih[item.kunci]) {
      masalah.push('kunci_tidak_cocok');
    }

    const kunciTeks = normalisasiTeksBiasa(item.pertanyaan).toLowerCase();
    if (kunciTeks && (hitungPertanyaan.get(kunciTeks) ?? 0) > 1) {
      masalah.push('soal_kembar');
    }

    const soalTerpotong =
      teksTerpotongMencurigakan(item.pertanyaan, true) ||
      pilihanBersih.some((p) => teksTerpotongMencurigakan(p, false));
    if (soalTerpotong) {
      masalah.push('teks_terpotong');
    }

    if (masalah.length > 0) {
      jumlahBermasalah += 1;
    }

    const peringatanDetail = masalah.map((kode) => LABEL_MASALAH[kode]);

    return {
      ...item,
      masalah,
      peringatanDetail,
    };
  });

  return {
    daftar: daftarTervalidasi,
    totalSoal: daftarTervalidasi.length,
    jumlahBermasalah,
    peringatanUmum: [...peringatanAwal],
  };
}

export function konversiDraftValidKeSoal(daftar: readonly DraftSoal[]): {
  soalValid: Soal[];
  jumlahDilewati: number;
} {
  const soalValid: Soal[] = [];
  let jumlahDilewati = 0;

  for (const draft of daftar) {
    const pilihanBersih = draft.pilihan.map((p) => p.trim()).filter((p) => p.length > 0);
    const kunciValid =
      draft.kunci !== null &&
      draft.kunci >= 0 &&
      draft.kunci < draft.pilihan.length &&
      draft.pilihan[draft.kunci].trim().length > 0;

    // Soal dengan masalah kritis (kurang pilihan / tanpa kunci / kunci tidak cocok) tidak masuk ke game
    const masalahKritis = draft.masalah.some(
      (m) => m === 'kunci_tidak_ditemukan' || m === 'kunci_tidak_cocok' || m === 'pilihan_kurang'
    );

    if (masalahKritis || !kunciValid || pilihanBersih.length < 2 || !draft.pertanyaan.trim()) {
      jumlahDilewati += 1;
      continue;
    }

    // Hitung ulang indeks kunci bila ada opsi kosong yang tersaring
    const teksKunci = draft.pilihan[draft.kunci!].trim();
    const indeksBaru = pilihanBersih.findIndex((p) => p === teksKunci);
    if (indeksBaru < 0) {
      jumlahDilewati += 1;
      continue;
    }

    soalValid.push({
      id: draft.id || buatId('soal'),
      pertanyaan: draft.pertanyaan.trim(),
      ...(draft.kode?.trim() ? { kode: draft.kode } : {}),
      pilihan: pilihanBersih.slice(0, 4),
      kunci: indeksBaru,
      ...(draft.penjelasan?.trim() ? { penjelasan: draft.penjelasan.trim() } : {}),
      ...(draft.tingkat ? { tingkat: draft.tingkat } : {}),
      ...(draft.topik?.trim() ? { topik: draft.topik.trim() } : {}),
      ...(draft.bonus ? { bonus: true } : {}),
    });
  }

  return { soalValid, jumlahDilewati };
}

export function acakUrutanPilihanDraft(draft: DraftSoal): DraftSoal {
  const entri = draft.pilihan.map((teks, indeksAsli) => ({
    teks,
    adalahKunci: draft.kunci === indeksAsli,
  }));
  const teracak = acakFisherYates(entri);
  const kunciBaru = teracak.findIndex((item) => item.adalahKunci);

  return {
    ...draft,
    pilihan: teracak.map((item) => item.teks),
    kunci: kunciBaru >= 0 ? kunciBaru : draft.kunci,
  };
}

export function soalKeDraft(soal: Soal, sumber: SumberImpor = 'manual'): DraftSoal {
  return {
    id: soal.id,
    pertanyaan: soal.pertanyaan,
    kode: soal.kode,
    pilihan: [...soal.pilihan],
    kunci: soal.kunci,
    penjelasan: soal.penjelasan,
    tingkat: soal.tingkat,
    topik: soal.topik,
    bonus: soal.bonus,
    sumber,
    masalah: [],
    peringatanDetail: [],
  };
}
