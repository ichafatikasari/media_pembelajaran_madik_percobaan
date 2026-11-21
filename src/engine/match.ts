import { Pengaturan, Soal, SoalSiswa, TimSisi } from '../data/types';
import { buatId } from '../utils/id';
import { acakFisherYates } from '../utils/shuffle';
import { ambilDaftarSoalUntukSiswa, cekJawaban } from './gameEngine';

export type FaseMatch = 'countdown' | 'bermain' | 'jeda' | 'penentuan' | 'selesai';

export type FaseTim = 'menjawab' | 'umpanBalik' | 'selesai';

export type AlasanAkhirMatch = 'waktu' | 'soalHabis' | 'keduanya' | 'penentuan' | null;

export type JenisRiwayat =
  | 'benar'
  | 'salah'
  | 'waktuHabis'
  | 'bonus'
  | 'manual'
  | 'penentuan';

export interface RekapPemain {
  nama: string;
  tim: TimSisi;
  soal: number;
  benar: number;
  salah: number;
}

export interface RiwayatTarikanMatch {
  id: string;
  urutan: number;
  waktuDetik: number;
  tim: TimSisi;
  pemain: string;
  soalId: string;
  jenis: JenisRiwayat;
  pilihanDipilih: number | null;
  benar: boolean;
  perubahanLangkah: number; // negatif ke merah (kiri), positif ke biru (kanan)
  posisiTaliSesudah: number;
  penjelasan?: string;
}

export interface UmpanBalikTim {
  jenis: 'benar' | 'salah' | 'waktuHabis';
  pilihanDipilih: number | null;
  kunciBenar: number;
  penjelasan?: string;
  bonusDipakai: boolean;
}

export interface TimMatchState {
  sisi: TimSisi;
  namaTim: string;
  roster: string[];
  dek: SoalSiswa[];
  indeksSoal: number;
  indeksGiliran: number;
  soalTerjawabCount: number;
  skorBenar: number;
  skorSalah: number;
  faseTim: FaseTim;
  sisaWaktuSoalMs: number;
  sisaUmpanBalikMs: number;
  umpanBalik: UmpanBalikTim | null;
  klikTerkunci: boolean;
  pemainTerakhir: string | null;
}

export interface PenentuanState {
  indeksCadangan: number;
  soalAktif: SoalSiswa | null;
  wakilKiri: string;
  wakilKanan: string;
  jawabanKiri: { pilihan: number | null; benar: boolean; terkunci: boolean } | null;
  jawabanKanan: { pilihan: number | null; benar: boolean; terkunci: boolean } | null;
  sisaWaktuSoalMs: number;
  sisaUmpanBalikMs: number;
  statusHasil: string | null;
}

export interface MatchState {
  gameId: string;
  labelLaga: string;
  fase: FaseMatch;
  faseSebelumJeda: 'countdown' | 'bermain' | 'penentuan';
  countdownMs: number;
  waktuBerjalanMs: number;
  sisaWaktuTotalMs: number | null;
  posisiTali: number; // negatif ke Tim A (kiri/merah), positif ke Tim B (kanan/biru)
  langkahKeGaris: number;
  timKiri: TimMatchState;
  timKanan: TimMatchState;
  cadanganSiswa: SoalSiswa[];
  riwayat: RiwayatTarikanMatch[];
  rekapPemain: Record<string, RekapPemain>;
  penentuan: PenentuanState | null;
  pemenang: TimSisi | 'seri' | null;
  alasanAkhir: AlasanAkhirMatch;
  pengaturan: Pengaturan;
  timestampTerakhir: number;
}

export type MatchAction =
  | { type: 'TICK'; deltaMs: number; timestamp: number }
  | { type: 'JAWAB'; tim: TimSisi; indeksPilihan: number; timestamp: number }
  | { type: 'JEDA' }
  | { type: 'LANJUT' }
  | { type: 'LEWATI_SOAL'; tim: TimSisi; timestamp: number }
  | { type: 'BATALKAN_TERAKHIR'; tim: TimSisi }
  | { type: 'KOREKSI_TALI_MANUAL'; arah: TimSisi; timestamp: number }
  | { type: 'ULANGI_SOAL'; tim: TimSisi };

export interface BuatMatchConfig {
  gameId: string;
  labelLaga: string;
  namaTimKiri: string;
  namaTimKanan: string;
  rosterKiri: string[];
  rosterKanan: string[];
  dekKiriSiswa: SoalSiswa[];
  dekKananSiswa: SoalSiswa[];
  cadanganSiswa: SoalSiswa[];
  pengaturan: Pengaturan;
  lewatiCountdown?: boolean;
}

const SESSION_KEY_MATCH = 'duel_otak_match_session_v1';

export const DURASI_COUNTDOWN_SIAP_MS = 2000;
export const DURASI_COUNTDOWN_PELUIT_AWAL_MS = 800;
export const DURASI_COUNTDOWN_ANGKA_MS = 1000;
export const DURASI_COUNTDOWN_TARIK_MS = 900;
export const TOTAL_DURASI_COUNTDOWN_MS =
  DURASI_COUNTDOWN_SIAP_MS +
  DURASI_COUNTDOWN_PELUIT_AWAL_MS +
  DURASI_COUNTDOWN_ANGKA_MS * 3 +
  DURASI_COUNTDOWN_TARIK_MS;

export type TahapCountdown = 'siap' | 'peluitAwal' | '3' | '2' | '1' | 'tarik';

export function ambilInfoCountdown(countdownMs: number): {
  tahap: TahapCountdown;
  teksUtama: string;
  subteks: string;
} {
  const sudahMs = Math.max(0, TOTAL_DURASI_COUNTDOWN_MS - Math.max(0, countdownMs));
  if (sudahMs < DURASI_COUNTDOWN_SIAP_MS) {
    return {
      tahap: 'siap',
      teksUtama: 'SIAP-SIAP!',
      subteks: 'Pegang tali erat-erat, fokus ke soal...',
    };
  }
  const batasPeluit = DURASI_COUNTDOWN_SIAP_MS + DURASI_COUNTDOWN_PELUIT_AWAL_MS;
  if (sudahMs < batasPeluit) {
    return {
      tahap: 'peluitAwal',
      teksUtama: 'SIAP-SIAP!',
      subteks: 'Peluit wasit pembuka berbunyi...',
    };
  }
  const batas3 = batasPeluit + DURASI_COUNTDOWN_ANGKA_MS;
  if (sudahMs < batas3) {
    return {
      tahap: '3',
      teksUtama: '3',
      subteks: 'Bersiap menjawab...',
    };
  }
  const batas2 = batas3 + DURASI_COUNTDOWN_ANGKA_MS;
  if (sudahMs < batas2) {
    return {
      tahap: '2',
      teksUtama: '2',
      subteks: 'Konsentrasi penuh...',
    };
  }
  const batas1 = batas2 + DURASI_COUNTDOWN_ANGKA_MS;
  if (sudahMs < batas1) {
    return {
      tahap: '1',
      teksUtama: '1',
      subteks: 'Sebentar lagi...',
    };
  }
  return {
    tahap: 'tarik',
    teksUtama: 'TARIK!',
    subteks: 'Ayo jawab cepat dan tepat!',
  };
}

function buatTimState(
  sisi: TimSisi,
  namaTim: string,
  roster: string[],
  dek: SoalSiswa[],
  durasiSoalDetik: number
): TimMatchState {
  const rosterBersih = roster.length > 0 ? [...roster] : ['Pemain 1', 'Pemain 2', 'Pemain 3'];
  return {
    sisi,
    namaTim,
    roster: rosterBersih,
    dek: [...dek],
    indeksSoal: 0,
    indeksGiliran: 0,
    soalTerjawabCount: 0,
    skorBenar: 0,
    skorSalah: 0,
    faseTim: dek.length > 0 ? 'menjawab' : 'selesai',
    sisaWaktuSoalMs: durasiSoalDetik * 1000,
    sisaUmpanBalikMs: 0,
    umpanBalik: null,
    klikTerkunci: false,
    pemainTerakhir: null,
  };
}

function kunciRekapPemain(tim: TimSisi, nama: string): string {
  return `${tim}::${nama}`;
}

function catatRekapPemain(
  rekap: Record<string, RekapPemain>,
  tim: TimSisi,
  nama: string,
  deltaSoal: number,
  deltaBenar: number,
  deltaSalah: number
): Record<string, RekapPemain> {
  const kunci = kunciRekapPemain(tim, nama);
  const lama = rekap[kunci] ?? { nama, tim, soal: 0, benar: 0, salah: 0 };
  return {
    ...rekap,
    [kunci]: {
      nama,
      tim,
      soal: Math.max(0, lama.soal + deltaSoal),
      benar: Math.max(0, lama.benar + deltaBenar),
      salah: Math.max(0, lama.salah + deltaSalah),
    },
  };
}

export function ambilPemainAktifTim(timState: TimMatchState): string {
  return timState.roster[timState.indeksGiliran % timState.roster.length] ?? 'Pemain 1';
}

export function ambilPutaranTim(timState: TimMatchState): number {
  const jumlah = Math.max(1, timState.roster.length);
  return 1 + Math.floor(timState.indeksGiliran / jumlah);
}

function pilihWakilAcakBukanTerakhir(roster: string[], terakhir: string | null): string {
  if (roster.length === 0) return 'Pemain 1';
  if (roster.length === 1) return roster[0];
  const kandidat = roster.filter((n) => n !== terakhir);
  const kolam = kandidat.length > 0 ? kandidat : roster;
  const idx = Math.floor(Math.random() * kolam.length);
  return kolam[idx];
}

function mulaiRondePenentuan(state: MatchState, indeksCadangan = 0): MatchState {
  const cadangan = state.cadanganSiswa;
  if (cadangan.length === 0) {
    return {
      ...state,
      fase: 'selesai',
      pemenang: 'seri',
      alasanAkhir: state.alasanAkhir ?? 'waktu',
    };
  }
  const idx = indeksCadangan % cadangan.length;
  return {
    ...state,
    fase: 'penentuan',
    faseSebelumJeda: 'penentuan',
    penentuan: {
      indeksCadangan: idx,
      soalAktif: cadangan[idx],
      wakilKiri: pilihWakilAcakBukanTerakhir(state.timKiri.roster, state.timKiri.pemainTerakhir),
      wakilKanan: pilihWakilAcakBukanTerakhir(state.timKanan.roster, state.timKanan.pemainTerakhir),
      jawabanKiri: null,
      jawabanKanan: null,
      sisaWaktuSoalMs: state.pengaturan.durasiSoal * 1000,
      sisaUmpanBalikMs: 0,
      statusHasil: null,
    },
  };
}

export function buatMatchState(config: BuatMatchConfig): MatchState {
  const durasiTotalMs =
    config.pengaturan.akhirPermainan === 'soalHabis'
      ? null
      : Math.max(0.5, config.pengaturan.durasiWaktu) * 60 * 1000;

  const rekapAwal: Record<string, RekapPemain> = {};
  for (const nama of config.rosterKiri) {
    rekapAwal[kunciRekapPemain('merah', nama)] = { nama, tim: 'merah', soal: 0, benar: 0, salah: 0 };
  }
  for (const nama of config.rosterKanan) {
    rekapAwal[kunciRekapPemain('biru', nama)] = { nama, tim: 'biru', soal: 0, benar: 0, salah: 0 };
  }

  return {
    gameId: config.gameId,
    labelLaga: config.labelLaga,
    fase: config.lewatiCountdown ? 'bermain' : 'countdown',
    faseSebelumJeda: config.lewatiCountdown ? 'bermain' : 'countdown',
    countdownMs: config.lewatiCountdown ? 0 : TOTAL_DURASI_COUNTDOWN_MS,
    waktuBerjalanMs: 0,
    sisaWaktuTotalMs: durasiTotalMs,
    posisiTali: 0,
    langkahKeGaris: Math.min(10, Math.max(3, config.pengaturan.langkahKeGaris || 6)),
    timKiri: buatTimState(
      'merah',
      config.namaTimKiri,
      config.rosterKiri,
      config.dekKiriSiswa,
      config.pengaturan.durasiSoal
    ),
    timKanan: buatTimState(
      'biru',
      config.namaTimKanan,
      config.rosterKanan,
      config.dekKananSiswa,
      config.pengaturan.durasiSoal
    ),
    cadanganSiswa: [...config.cadanganSiswa],
    riwayat: [],
    rekapPemain: rekapAwal,
    penentuan: null,
    pemenang: null,
    alasanAkhir: null,
    pengaturan: config.pengaturan,
    timestampTerakhir: Date.now(),
  };
}

function selesaikanAtauPenentuan(state: MatchState, alasan: AlasanAkhirMatch): MatchState {
  if (state.posisiTali === 0) {
    return mulaiRondePenentuan({ ...state, alasanAkhir: alasan }, 0);
  }
  return {
    ...state,
    fase: 'selesai',
    pemenang: state.posisiTali < 0 ? 'merah' : 'biru',
    alasanAkhir: alasan,
  };
}

function majukanSoalTim(tim: TimMatchState, pengaturan: Pengaturan): TimMatchState {
  const indeksBerikutnya = tim.indeksSoal + 1;
  const giliranBerikutnya = tim.indeksGiliran + 1;

  if (indeksBerikutnya < tim.dek.length) {
    return {
      ...tim,
      indeksSoal: indeksBerikutnya,
      indeksGiliran: giliranBerikutnya,
      faseTim: 'menjawab',
      sisaWaktuSoalMs: pengaturan.durasiSoal * 1000,
      sisaUmpanBalikMs: 0,
      umpanBalik: null,
      klikTerkunci: false,
    };
  }

  // Jika mode berakhir karena WAKTU saja dan dek tim habis sebelum waktu habis: acak ulang dek tim
  if (pengaturan.akhirPermainan === 'waktu' && tim.dek.length > 0) {
    return {
      ...tim,
      dek: acakFisherYates(tim.dek),
      indeksSoal: 0,
      indeksGiliran: giliranBerikutnya,
      faseTim: 'menjawab',
      sisaWaktuSoalMs: pengaturan.durasiSoal * 1000,
      sisaUmpanBalikMs: 0,
      umpanBalik: null,
      klikTerkunci: false,
    };
  }

  return {
    ...tim,
    indeksSoal: indeksBerikutnya,
    indeksGiliran: giliranBerikutnya,
    faseTim: 'selesai',
    sisaWaktuSoalMs: 0,
    sisaUmpanBalikMs: 0,
    umpanBalik: null,
    klikTerkunci: true,
  };
}

function prosesJawabanTim(
  state: MatchState,
  sisi: TimSisi,
  indeksPilihan: number | null,
  bankSoal: readonly Soal[],
  timestamp: number
): MatchState {
  const tim = sisi === 'merah' ? state.timKiri : state.timKanan;
  if (tim.faseTim !== 'menjawab' || tim.klikTerkunci) {
    return state;
  }

  const soalSiswa = tim.dek[tim.indeksSoal];
  if (!soalSiswa) {
    return state;
  }

  const hasilCek = cekJawaban(
    bankSoal,
    soalSiswa.id,
    indeksPilihan,
    state.pengaturan.penjelasan,
    state.pengaturan.bonus
  );

  const pemainAktif = ambilPemainAktifTim(tim);
  const apakahWaktuHabis = indeksPilihan === null;
  const bonusDipakai = Boolean(hasilCek.benar && state.pengaturan.bonus && soalSiswa.bonus);

  let perubahanLangkah = 0;
  let jenisRiwayat: JenisRiwayat = 'salah';

  if (hasilCek.benar) {
    const besar = bonusDipakai ? 2 : 1;
    perubahanLangkah = sisi === 'merah' ? -besar : besar;
    jenisRiwayat = bonusDipakai ? 'bonus' : 'benar';
  } else {
    jenisRiwayat = apakahWaktuHabis ? 'waktuHabis' : 'salah';
    if (state.pengaturan.salahMenarikLawan) {
      // Menarik tali 1 langkah ke arah LAWAN
      perubahanLangkah = sisi === 'merah' ? 1 : -1;
    }
  }

  const posisiBaru = state.posisiTali + perubahanLangkah;
  const entriRiwayat: RiwayatTarikanMatch = {
    id: buatId('tarik'),
    urutan: state.riwayat.length + 1,
    waktuDetik: Math.floor(state.waktuBerjalanMs / 1000),
    tim: sisi,
    pemain: pemainAktif,
    soalId: soalSiswa.id,
    jenis: jenisRiwayat,
    pilihanDipilih: indeksPilihan,
    benar: hasilCek.benar,
    perubahanLangkah,
    posisiTaliSesudah: posisiBaru,
    penjelasan: hasilCek.penjelasan,
  };

  const adaPenjelasan = Boolean(state.pengaturan.penjelasan && hasilCek.penjelasan);
  const durasiUmpanBalik = adaPenjelasan ? 3900 : 900;

  const timBaru: TimMatchState = {
    ...tim,
    skorBenar: tim.skorBenar + (hasilCek.benar ? 1 : 0),
    skorSalah: tim.skorSalah + (hasilCek.benar ? 0 : 1),
    soalTerjawabCount: tim.soalTerjawabCount + 1,
    faseTim: 'umpanBalik',
    sisaUmpanBalikMs: durasiUmpanBalik,
    klikTerkunci: true,
    pemainTerakhir: pemainAktif,
    umpanBalik: {
      jenis: hasilCek.benar ? 'benar' : apakahWaktuHabis ? 'waktuHabis' : 'salah',
      pilihanDipilih: indeksPilihan,
      kunciBenar: hasilCek.kunciIndeks,
      penjelasan: hasilCek.penjelasan,
      bonusDipakai,
    },
  };

  const rekapBaru = catatRekapPemain(
    state.rekapPemain,
    sisi,
    pemainAktif,
    1,
    hasilCek.benar ? 1 : 0,
    hasilCek.benar ? 0 : 1
  );

  return {
    ...state,
    posisiTali: posisiBaru,
    timKiri: sisi === 'merah' ? timBaru : state.timKiri,
    timKanan: sisi === 'biru' ? timBaru : state.timKanan,
    riwayat: [...state.riwayat, entriRiwayat],
    rekapPemain: rekapBaru,
    timestampTerakhir: timestamp,
  };
}

function prosesPenentuanJawab(
  state: MatchState,
  sisi: TimSisi,
  indeksPilihan: number | null,
  bankSoal: readonly Soal[],
  timestamp: number
): MatchState {
  const pen = state.penentuan;
  if (!pen || !pen.soalAktif || pen.sisaUmpanBalikMs > 0) {
    return state;
  }

  if (sisi === 'merah' && pen.jawabanKiri?.terkunci) return state;
  if (sisi === 'biru' && pen.jawabanKanan?.terkunci) return state;

  const cek = cekJawaban(bankSoal, pen.soalAktif.id, indeksPilihan, false, false);
  const jawabanObj = { pilihan: indeksPilihan, benar: cek.benar, terkunci: true };

  const penBaru: PenentuanState = {
    ...pen,
    jawabanKiri: sisi === 'merah' ? jawabanObj : pen.jawabanKiri,
    jawabanKanan: sisi === 'biru' ? jawabanObj : pen.jawabanKanan,
  };

  // Evaluasi hanya jika KEDUA tim sudah menjawab
  if (!penBaru.jawabanKiri || !penBaru.jawabanKanan) {
    return { ...state, penentuan: penBaru, timestampTerakhir: timestamp };
  }

  return evaluasiHasilPenentuan({ ...state, penentuan: penBaru, timestampTerakhir: timestamp });
}

function evaluasiHasilPenentuan(state: MatchState): MatchState {
  const pen = state.penentuan;
  if (!pen || !pen.soalAktif) return state;

  const kiriBenar = Boolean(pen.jawabanKiri?.benar);
  const kananBenar = Boolean(pen.jawabanKanan?.benar);

  let rekap = catatRekapPemain(
    state.rekapPemain,
    'merah',
    pen.wakilKiri,
    1,
    kiriBenar ? 1 : 0,
    kiriBenar ? 0 : 1
  );
  rekap = catatRekapPemain(
    rekap,
    'biru',
    pen.wakilKanan,
    1,
    kananBenar ? 1 : 0,
    kananBenar ? 0 : 1
  );

  if (kiriBenar !== kananBenar) {
    const pemenang: TimSisi = kiriBenar ? 'merah' : 'biru';
    const delta = pemenang === 'merah' ? -1 : 1;
    const posisiBaru = state.posisiTali + delta;
    const entri: RiwayatTarikanMatch = {
      id: buatId('tarik'),
      urutan: state.riwayat.length + 1,
      waktuDetik: Math.floor(state.waktuBerjalanMs / 1000),
      tim: pemenang,
      pemain: pemenang === 'merah' ? pen.wakilKiri : pen.wakilKanan,
      soalId: pen.soalAktif.id,
      jenis: 'penentuan',
      pilihanDipilih:
        pemenang === 'merah'
          ? (pen.jawabanKiri?.pilihan ?? null)
          : (pen.jawabanKanan?.pilihan ?? null),
      benar: true,
      perubahanLangkah: delta,
      posisiTaliSesudah: posisiBaru,
    };

    return {
      ...state,
      fase: 'selesai',
      posisiTali: posisiBaru,
      riwayat: [...state.riwayat, entri],
      rekapPemain: rekap,
      pemenang,
      alasanAkhir: 'penentuan',
      penentuan: {
        ...pen,
        statusHasil: `${pemenang === 'merah' ? state.timKiri.namaTim : state.timKanan.namaTim} menang Ronde Penentuan!`,
      },
    };
  }

  // Masih imbang -> beri jeda umpan balik singkat lalu soal cadangan berikutnya
  return {
    ...state,
    rekapPemain: rekap,
    penentuan: {
      ...pen,
      sisaUmpanBalikMs: 1200,
      statusHasil:
        kiriBenar && kananBenar
          ? 'Keduanya benar! Lanjut soal cadangan berikutnya...'
          : 'Keduanya salah! Lanjut soal cadangan berikutnya...',
    },
  };
}

function hitungTotalSelisihRiwayat(riwayat: readonly RiwayatTarikanMatch[]): number {
  return riwayat.reduce((acc, item) => acc + item.perubahanLangkah, 0);
}

/**
 * Reducer murni mesin permainan tarik tambang.
 */
export function matchReducer(
  state: MatchState,
  action: MatchAction,
  bankSoal: readonly Soal[]
): MatchState {
  switch (action.type) {
    case 'JEDA': {
      if (state.fase !== 'countdown' && state.fase !== 'bermain' && state.fase !== 'penentuan') {
        return state;
      }
      return {
        ...state,
        fase: 'jeda',
        faseSebelumJeda: state.fase,
      };
    }

    case 'LANJUT': {
      if (state.fase !== 'jeda') {
        return state;
      }
      const ulangCountdown = state.faseSebelumJeda === 'countdown';
      return {
        ...state,
        fase: state.faseSebelumJeda,
        countdownMs: ulangCountdown ? TOTAL_DURASI_COUNTDOWN_MS : state.countdownMs,
        timestampTerakhir: Date.now(),
      };
    }

    case 'JAWAB': {
      if (state.fase === 'bermain') {
        return prosesJawabanTim(state, action.tim, action.indeksPilihan, bankSoal, action.timestamp);
      }
      if (state.fase === 'penentuan') {
        return prosesPenentuanJawab(
          state,
          action.tim,
          action.indeksPilihan,
          bankSoal,
          action.timestamp
        );
      }
      return state;
    }

    case 'TICK': {
      const delta = Math.max(0, action.deltaMs);
      if (delta === 0 || state.fase === 'jeda' || state.fase === 'selesai') {
        return state;
      }

      if (state.fase === 'countdown') {
        const sisa = state.countdownMs - delta;
        if (sisa <= 0) {
          return {
            ...state,
            fase: 'bermain',
            faseSebelumJeda: 'bermain',
            countdownMs: 0,
            timestampTerakhir: action.timestamp,
          };
        }
        return { ...state, countdownMs: sisa, timestampTerakhir: action.timestamp };
      }

      if (state.fase === 'penentuan' && state.penentuan) {
        const pen = state.penentuan;
        if (pen.sisaUmpanBalikMs > 0) {
          const sisaFb = pen.sisaUmpanBalikMs - delta;
          if (sisaFb <= 0) {
            return mulaiRondePenentuan(state, pen.indeksCadangan + 1);
          }
          return {
            ...state,
            penentuan: { ...pen, sisaUmpanBalikMs: sisaFb },
            timestampTerakhir: action.timestamp,
          };
        }

        const sisaSoalPen = pen.sisaWaktuSoalMs - delta;
        if (sisaSoalPen <= 0) {
          const jawabanKiri = pen.jawabanKiri ?? { pilihan: null, benar: false, terkunci: true };
          const jawabanKanan = pen.jawabanKanan ?? { pilihan: null, benar: false, terkunci: true };
          return evaluasiHasilPenentuan({
            ...state,
            penentuan: {
              ...pen,
              sisaWaktuSoalMs: 0,
              jawabanKiri,
              jawabanKanan,
            },
            timestampTerakhir: action.timestamp,
          });
        }

        return {
          ...state,
          penentuan: { ...pen, sisaWaktuSoalMs: sisaSoalPen },
          timestampTerakhir: action.timestamp,
        };
      }

      // Fase 'bermain'
      let berikut: MatchState = {
        ...state,
        waktuBerjalanMs: state.waktuBerjalanMs + delta,
        timestampTerakhir: action.timestamp,
      };

      // Cek waktu total habis terlebih dahulu (soal yang sedang berjalan dibatalkan, tidak dihitung)
      if (berikut.sisaWaktuTotalMs !== null) {
        const sisaTotal = berikut.sisaWaktuTotalMs - delta;
        if (sisaTotal <= 0) {
          return selesaikanAtauPenentuan(
            { ...berikut, sisaWaktuTotalMs: 0 },
            state.pengaturan.akhirPermainan === 'keduanya' ? 'keduanya' : 'waktu'
          );
        }
        berikut.sisaWaktuTotalMs = sisaTotal;
      }

      // Update timer masing-masing tim secara mandiri
      const prosesTickTim = (sisi: TimSisi, st: MatchState): MatchState => {
        const tim = sisi === 'merah' ? st.timKiri : st.timKanan;
        if (tim.faseTim === 'selesai') return st;

        if (tim.faseTim === 'umpanBalik') {
          const sisaFb = tim.sisaUmpanBalikMs - delta;
          if (sisaFb <= 0) {
            const timMaju = majukanSoalTim(tim, st.pengaturan);
            return {
              ...st,
              timKiri: sisi === 'merah' ? timMaju : st.timKiri,
              timKanan: sisi === 'biru' ? timMaju : st.timKanan,
            };
          }
          const timFb: TimMatchState = { ...tim, sisaUmpanBalikMs: sisaFb };
          return {
            ...st,
            timKiri: sisi === 'merah' ? timFb : st.timKiri,
            timKanan: sisi === 'biru' ? timFb : st.timKanan,
          };
        }

        // tim.faseTim === 'menjawab'
        const sisaSoal = tim.sisaWaktuSoalMs - delta;
        if (sisaSoal <= 0) {
          return prosesJawabanTim(st, sisi, null, bankSoal, action.timestamp);
        }

        const timTimer: TimMatchState = { ...tim, sisaWaktuSoalMs: sisaSoal };
        return {
          ...st,
          timKiri: sisi === 'merah' ? timTimer : st.timKiri,
          timKanan: sisi === 'biru' ? timTimer : st.timKanan,
        };
      };

      berikut = prosesTickTim('merah', berikut);
      berikut = prosesTickTim('biru', berikut);

      // Cek jika kedua tim sudah menyelesaikan dek-nya (SOAL HABIS atau KEDUANYA)
      if (
        berikut.timKiri.faseTim === 'selesai' &&
        berikut.timKanan.faseTim === 'selesai' &&
        berikut.pengaturan.akhirPermainan !== 'waktu'
      ) {
        return selesaikanAtauPenentuan(
          berikut,
          berikut.pengaturan.akhirPermainan === 'keduanya' ? 'keduanya' : 'soalHabis'
        );
      }

      return berikut;
    }

    case 'LEWATI_SOAL': {
      if (state.fase !== 'bermain' && state.fase !== 'jeda') return state;
      const targetTim = action.tim === 'merah' ? state.timKiri : state.timKanan;
      if (targetTim.faseTim === 'selesai') return state;
      const maju = majukanSoalTim(targetTim, state.pengaturan);
      return {
        ...state,
        timKiri: action.tim === 'merah' ? maju : state.timKiri,
        timKanan: action.tim === 'biru' ? maju : state.timKanan,
      };
    }

    case 'KOREKSI_TALI_MANUAL': {
      const delta = action.arah === 'merah' ? -1 : 1;
      const posisiBaru = state.posisiTali + delta;
      const entri: RiwayatTarikanMatch = {
        id: buatId('tarik'),
        urutan: state.riwayat.length + 1,
        waktuDetik: Math.floor(state.waktuBerjalanMs / 1000),
        tim: action.arah,
        pemain: 'Koreksi Guru',
        soalId: '-',
        jenis: 'manual',
        pilihanDipilih: null,
        benar: true,
        perubahanLangkah: delta,
        posisiTaliSesudah: posisiBaru,
      };
      return {
        ...state,
        posisiTali: posisiBaru,
        riwayat: [...state.riwayat, entri],
        timestampTerakhir: action.timestamp,
      };
    }

    case 'BATALKAN_TERAKHIR': {
      // Cari entri non-manual terakhir milik tim yang dipilih
      let idxHapus = -1;
      for (let i = state.riwayat.length - 1; i >= 0; i -= 1) {
        const item = state.riwayat[i];
        if (item.tim === action.tim && item.jenis !== 'manual') {
          idxHapus = i;
          break;
        }
      }
      if (idxHapus === -1) return state;

      const dihapus = state.riwayat[idxHapus];
      const riwayatSisa = state.riwayat.filter((_, idx) => idx !== idxHapus);

      // Hitung ulang posisiTaliSesudah seluruh riwayat agar selisih layar === jumlah riwayat
      let akumulasi = 0;
      const riwayatBaru = riwayatSisa.map((item, idx) => {
        akumulasi += item.perubahanLangkah;
        return {
          ...item,
          urutan: idx + 1,
          posisiTaliSesudah: akumulasi,
        };
      });

      const timLama = action.tim === 'merah' ? state.timKiri : state.timKanan;
      const timBaru: TimMatchState = {
        ...timLama,
        skorBenar: Math.max(0, timLama.skorBenar - (dihapus.benar ? 1 : 0)),
        skorSalah: Math.max(0, timLama.skorSalah - (dihapus.benar ? 0 : 1)),
        soalTerjawabCount: Math.max(0, timLama.soalTerjawabCount - 1),
      };

      const rekapBaru = catatRekapPemain(
        state.rekapPemain,
        action.tim,
        dihapus.pemain,
        -1,
        dihapus.benar ? -1 : 0,
        dihapus.benar ? 0 : -1
      );

      return {
        ...state,
        posisiTali: hitungTotalSelisihRiwayat(riwayatBaru),
        riwayat: riwayatBaru,
        rekapPemain: rekapBaru,
        timKiri: action.tim === 'merah' ? timBaru : state.timKiri,
        timKanan: action.tim === 'biru' ? timBaru : state.timKanan,
      };
    }

    case 'ULANGI_SOAL': {
      if (!state.pengaturan.ulangiSoal) return state;
      const target = action.tim === 'merah' ? state.timKiri : state.timKanan;
      if (target.faseTim === 'selesai') return state;
      const resetSoal: TimMatchState = {
        ...target,
        faseTim: 'menjawab',
        sisaWaktuSoalMs: state.pengaturan.durasiSoal * 1000,
        sisaUmpanBalikMs: 0,
        umpanBalik: null,
        klikTerkunci: false,
      };
      return {
        ...state,
        timKiri: action.tim === 'merah' ? resetSoal : state.timKiri,
        timKanan: action.tim === 'biru' ? resetSoal : state.timKanan,
      };
    }

    default:
      return state;
  }
}

export function simpanSesiMatchSessionStorage(state: MatchState): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(SESSION_KEY_MATCH, JSON.stringify(state));
    }
  } catch {
    // Abaikan jika sessionStorage tidak tersedia
  }
}

export function bacaSesiMatchSessionStorage(): MatchState | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return null;
    }
    const mentah = window.sessionStorage.getItem(SESSION_KEY_MATCH);
    if (!mentah) return null;
    return JSON.parse(mentah) as MatchState;
  } catch {
    return null;
  }
}

export function hapusSesiMatchSessionStorage(): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(SESSION_KEY_MATCH);
    }
  } catch {
    // Abaikan jika sessionStorage gagal diakses
  }
}

/**
 * Mengambil kunci jawaban khusus untuk Panel Guru (terpisah dari data tampilan siswa).
 */
export function ambilKunciUntukPanelGuru(
  bankSoal: readonly Soal[],
  soalId: string
): { huruf: string; teks: string } | null {
  const s = bankSoal.find((item) => item.id === soalId);
  if (!s) return null;
  return {
    huruf: String.fromCharCode(65 + s.kunci),
    teks: s.pilihan[s.kunci] ?? '',
  };
}

export function buatDekSiswaDariBank(bankSoal: readonly Soal[]): SoalSiswa[] {
  return ambilDaftarSoalUntukSiswa(bankSoal);
}
