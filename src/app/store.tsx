import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { buatContohGameBawaan } from '../data/contohGame';
import { Game, Pengaturan, Soal, SoalSiswa, TimSisi } from '../data/types';
import {
  ambilRosterEfektif,
  bagiSoalPertandingan,
  buatPasanganDuelDenganTanda,
  buatUrutanEstafet,
  hitungPerkiraanKebutuhanSoal,
  PasanganDuelTerundi,
  undiPasanganDuel,
} from '../engine/deal';
import { buatPengaturanDefault } from '../engine/gameEngine';
import { MatchState, RiwayatTarikanMatch } from '../engine/match';
import {
  akhiriSesiDuelManual,
  bacaSesiModeSessionStorage,
  buatSesiDuel,
  buatSesiTurnamen,
  catatHasilLagaKeSesi,
  hapusSesiModeSessionStorage,
  SesiModeAktif,
  simpanSesiModeSessionStorage,
  siapkanDekLagaBerikutnya,
} from '../engine/session';
import { ItemToast, JenisToast } from '../components/Toast';
import { ambilKodeOnlineTersimpanUntukGame } from '../services/gameOnlineService';
import { STORAGE_KEYS } from '../utils/constants';
import { buatId } from '../utils/id';
import { catatRiwayatDibuka } from '../utils/riwayatDibuka';
import { apakahLocalStorageTersedia, bacaStorage, tulisStorage } from '../utils/storage';

export interface RingkasanHasilSesi {
  mode?: Game['pengaturan']['mode'];
  labelLaga?: string;
  pemenang: TimSisi | 'seri';
  namaTimKiri: string;
  namaTimKanan: string;
  skorMerah: number;
  skorSalahMerah: number;
  skorBiru: number;
  skorSalahBiru: number;
  posisiTaliAkhir: number;
  totalSoalTerjawab: number;
  alasanAkhir: 'waktu' | 'soalHabis' | 'keduanya' | 'penentuan' | null;
  rekapPemain: {
    nama: string;
    tim: TimSisi;
    soal: number;
    benar: number;
    salah: number;
  }[];
  riwayat?: RiwayatTarikanMatch[];
}

export interface IdentitasGameInput {
  judul: string;
  mapel: string;
  namaSekolah: string;
}

export interface SesiPembagianPertandingan {
  gameId: string;
  nomorLaga: number;
  labelLaga: string;
  namaTimKiri: string;
  namaTimKanan: string;
  urutanPemainKiri: string[];
  urutanPemainKanan: string[];
  dekKiriSiswa: SoalSiswa[];
  dekKananSiswa: SoalSiswa[];
  cadanganSiswa: SoalSiswa[];
  ringkasanKiri: Record<string, number>;
  ringkasanKanan: Record<string, number>;
  terpakaiIds: string[];
  bankDiacakUlang: boolean;
  pasanganDuel: [string, string][];
}

interface AppStoreValue {
  daftarGame: Game[];
  gameAktif: Game;
  penyimpananTersedia: boolean;
  daftarToast: ItemToast[];
  hasilSesi: RingkasanHasilSesi;
  sesiPembagian: SesiPembagianPertandingan | null;
  sesiMode: SesiModeAktif | null;
  pinEditTerbukaId: string | null;
  bukaIzinEditDenganPin: (gameId: string) => void;
  tutupIzinEditPin: () => void;
  pilihGameAktif: (id: string) => void;
  tambahGameBaru: (judul: string, mapel: string, namaSekolah: string) => Game;
  simpanSoalKeGameAktif: (
    identitas: IdentitasGameInput,
    soalList: Soal[],
    mode: 'ganti' | 'tambah',
    status?: 'draf' | 'siap'
  ) => Game;
  buatGameDenganSoal: (
    identitas: IdentitasGameInput,
    soalList: Soal[],
    status?: 'draf' | 'siap'
  ) => Game;
  duplikasiGame: (id: string) => Game | null;
  ubahNamaGame: (
    id: string,
    judulBaru: string,
    mapelBaru?: string,
    namaSekolahBaru?: string
  ) => Game | null;
  imporGameDariPaket: (
    gamePaket: Game,
    strategi: 'simpan_baru' | 'timpa',
    targetTimpaId?: string
  ) => Game;
  hapusGame: (id: string) => void;
  perbaruiPengaturanGameAktif: (
    pengaturan: Pengaturan,
    identitas?: Partial<IdentitasGameInput>
  ) => Game;
  mulaiSesiPembagian: (
    gameSumber?: Game,
    pasanganDuel?: [string, string][]
  ) => SesiPembagianPertandingan;
  mulaiSesiTurnamenBaru: (gameSumber?: Game) => SesiModeAktif;
  mulaiSesiDuelBaru: (
    gameSumber?: Game,
    pasanganInput?: PasanganDuelTerundi[]
  ) => SesiModeAktif;
  siapkanLagaDariSesiMode: () => SesiPembagianPertandingan | null;
  catatLagaSelesaiKeSesiMode: (match: MatchState) => SesiModeAktif | null;
  akhiriDuelSekarang: () => SesiModeAktif | null;
  resetSesiMode: () => void;
  siapkanLagaBerikutnya: () => void;
  pulihkanContohGame: () => void;
  setHasilSesi: (hasil: RingkasanHasilSesi) => void;
  tampilkanToast: (pesan: string, jenis?: JenisToast) => void;
  hapusToast: (id: string) => void;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

function urutkanGameTerbaru(daftar: Game[]): Game[] {
  return [...daftar].sort((a, b) => (b.diubahPada ?? 0) - (a.diubahPada ?? 0));
}

function muatDaftarGameAwal(): Game[] {
  const tersimpan = bacaStorage<Game[]>(STORAGE_KEYS.GAMES, []);
  if (Array.isArray(tersimpan) && tersimpan.length > 0) {
    return urutkanGameTerbaru(tersimpan);
  }
  const contoh = buatContohGameBawaan();
  tulisStorage(STORAGE_KEYS.GAMES, [contoh]);
  return [contoh];
}

function tentukanDetailLaga(
  pengaturan: Pengaturan,
  nomorLaga: number,
  pasanganDuel: [string, string][]
): {
  labelLaga: string;
  namaTimKiri: string;
  namaTimKanan: string;
  anggotaKiri: string[];
  anggotaKanan: string[];
} {
  if (pengaturan.mode === '4tim') {
    const indeksLaga = (nomorLaga - 1) % 3;
    if (indeksLaga === 0) {
      return {
        labelLaga: 'Semifinal 1 (Merah vs Biru)',
        namaTimKiri: pengaturan.namaTim[0] || 'Tim Merah',
        namaTimKanan: pengaturan.namaTim[1] || 'Tim Biru',
        anggotaKiri: ambilRosterEfektif(pengaturan.anggota[0] ?? [], pengaturan.jumlahPenarik),
        anggotaKanan: ambilRosterEfektif(pengaturan.anggota[1] ?? [], pengaturan.jumlahPenarik),
      };
    }
    if (indeksLaga === 1) {
      return {
        labelLaga: 'Semifinal 2 (Tampil sebagai Merah vs Biru)',
        namaTimKiri: pengaturan.namaTim[2] || 'Tim Hijau',
        namaTimKanan: pengaturan.namaTim[3] || 'Tim Kuning',
        anggotaKiri: ambilRosterEfektif(pengaturan.anggota[2] ?? [], pengaturan.jumlahPenarik),
        anggotaKanan: ambilRosterEfektif(pengaturan.anggota[3] ?? [], pengaturan.jumlahPenarik),
      };
    }
    return {
      labelLaga: 'Final Juara (Pemenang Semifinal 1 vs Semifinal 2)',
      namaTimKiri: `Juara ${pengaturan.namaTim[0] || 'SF1'}`,
      namaTimKanan: `Juara ${pengaturan.namaTim[2] || 'SF2'}`,
      anggotaKiri: ambilRosterEfektif(pengaturan.anggota[0] ?? [], pengaturan.jumlahPenarik),
      anggotaKanan: ambilRosterEfektif(pengaturan.anggota[2] ?? [], pengaturan.jumlahPenarik),
    };
  }

  if (pengaturan.mode === '1lawan1') {
    const daftarPasangan =
      pasanganDuel.length > 0
        ? pasanganDuel
        : undiPasanganDuel([...(pengaturan.anggota[0] ?? []), ...(pengaturan.anggota[1] ?? [])]);
    const pasangan = daftarPasangan[(nomorLaga - 1) % daftarPasangan.length] ?? [
      pengaturan.namaTim[0] || 'Pemain 1',
      pengaturan.namaTim[1] || 'Pemain 2',
    ];
    return {
      labelLaga: `Duel 1 Lawan 1 · Partai ${((nomorLaga - 1) % daftarPasangan.length) + 1}`,
      namaTimKiri: pasangan[0],
      namaTimKanan: pasangan[1],
      anggotaKiri: [pasangan[0]],
      anggotaKanan: [pasangan[1]],
    };
  }

  return {
    labelLaga: nomorLaga === 1 ? 'Pertandingan Utama (2 Tim)' : `Pertandingan Ke-${nomorLaga}`,
    namaTimKiri: pengaturan.namaTim[0] || 'Tim Merah',
    namaTimKanan: pengaturan.namaTim[1] || 'Tim Biru',
    anggotaKiri: ambilRosterEfektif(pengaturan.anggota[0] ?? [], pengaturan.jumlahPenarik),
    anggotaKanan: ambilRosterEfektif(pengaturan.anggota[1] ?? [], pengaturan.jumlahPenarik),
  };
}

export function buatSesiPembagianMurni(
  gameSumber: Game,
  nomorLaga = 1,
  terpakaiSebelumnya: string[] = [],
  pasanganDuelInput: [string, string][] = []
): SesiPembagianPertandingan {
  const pasanganDuel =
    pasanganDuelInput.length > 0
      ? pasanganDuelInput
      : gameSumber.pengaturan.mode === '1lawan1'
        ? undiPasanganDuel([
            ...(gameSumber.pengaturan.anggota[0] ?? []),
            ...(gameSumber.pengaturan.anggota[1] ?? []),
          ])
        : [];

  const perkiraan = hitungPerkiraanKebutuhanSoal(gameSumber.pengaturan, gameSumber.soal.length);
  const jumlahPerTim =
    gameSumber.pengaturan.akhirPermainan === 'soalHabis'
      ? Math.max(1, Math.floor(gameSumber.soal.length / 2))
      : Math.min(Math.max(5, Math.floor(gameSumber.soal.length / 2)), perkiraan.soalPerTimPerLaga);

  const hasilBagi = bagiSoalPertandingan(
    gameSumber.soal,
    terpakaiSebelumnya,
    jumlahPerTim,
    5
  );

  const detail = tentukanDetailLaga(gameSumber.pengaturan, nomorLaga, pasanganDuel);
  const jumlahGiliran = Math.max(8, hasilBagi.dekKiriSiswa.length);

  return {
    gameId: gameSumber.id,
    nomorLaga,
    labelLaga: detail.labelLaga,
    namaTimKiri: detail.namaTimKiri,
    namaTimKanan: detail.namaTimKanan,
    urutanPemainKiri: buatUrutanEstafet(
      detail.anggotaKiri,
      gameSumber.pengaturan.jumlahPenarik,
      jumlahGiliran
    ),
    urutanPemainKanan: buatUrutanEstafet(
      detail.anggotaKanan,
      gameSumber.pengaturan.jumlahPenarik,
      jumlahGiliran
    ),
    dekKiriSiswa: hasilBagi.dekKiriSiswa,
    dekKananSiswa: hasilBagi.dekKananSiswa,
    cadanganSiswa: hasilBagi.cadanganSiswa,
    ringkasanKiri: hasilBagi.ringkasanKiri,
    ringkasanKanan: hasilBagi.ringkasanKanan,
    terpakaiIds: hasilBagi.terpakaiIdsSesudah,
    bankDiacakUlang: hasilBagi.bankDiacakUlang,
    pasanganDuel,
  };
}

export const AppStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [daftarGame, setDaftarGame] = useState<Game[]>(() => muatDaftarGameAwal());
  const [gameAktifId, setGameAktifId] = useState<string>(() => {
    return bacaStorage<string>(STORAGE_KEYS.ACTIVE_GAME_ID, '');
  });
  const [penyimpananTersedia, setPenyimpananTersedia] = useState<boolean>(() =>
    apakahLocalStorageTersedia()
  );
  const [pinEditTerbukaId, setPinEditTerbukaId] = useState<string | null>(null);
  const [daftarToast, setDaftarToast] = useState<ItemToast[]>([]);
  const [sesiPembagian, setSesiPembagian] = useState<SesiPembagianPertandingan | null>(null);
  const [sesiMode, setSesiMode] = useState<SesiModeAktif | null>(() =>
    bacaSesiModeSessionStorage()
  );
  const [hasilSesi, setHasilSesi] = useState<RingkasanHasilSesi>({
    mode: '2tim',
    pemenang: 'merah',
    namaTimKiri: 'Tim Merah',
    namaTimKanan: 'Tim Biru',
    skorMerah: 0,
    skorSalahMerah: 0,
    skorBiru: 0,
    skorSalahBiru: 0,
    posisiTaliAkhir: 0,
    totalSoalTerjawab: 0,
    alasanAkhir: null,
    rekapPemain: [],
    riwayat: [],
  });

  const timerToastRef = useRef<Map<string, number>>(new Map());

  const gameAktif = useMemo(() => {
    const cocok = daftarGame.find((g) => g.id === gameAktifId);
    return cocok ?? daftarGame[0] ?? buatContohGameBawaan();
  }, [daftarGame, gameAktifId]);

  const hapusToast = useCallback((id: string) => {
    const timer = timerToastRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timerToastRef.current.delete(id);
    }
    setDaftarToast((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const tampilkanToast = useCallback(
    (pesan: string, jenis: JenisToast = 'info') => {
      const id = buatId('toast');
      setDaftarToast((prev) => [...prev.slice(-2), { id, pesan, jenis }]);
      const timer = window.setTimeout(() => {
        hapusToast(id);
      }, 3800);
      timerToastRef.current.set(id, timer);
    },
    [hapusToast]
  );

  const simpanDaftarKeStorage = useCallback((daftar: Game[]) => {
    const terurut = urutkanGameTerbaru(daftar);
    const berhasil = tulisStorage(STORAGE_KEYS.GAMES, terurut);
    setPenyimpananTersedia(berhasil);
    return terurut;
  }, []);

  const bukaIzinEditDenganPin = useCallback((gameId: string) => {
    setPinEditTerbukaId(gameId);
  }, []);

  const tutupIzinEditPin = useCallback(() => {
    setPinEditTerbukaId(null);
  }, []);

  const pilihGameAktif = useCallback(
    (id: string) => {
      setGameAktifId(id);
      const berhasil = tulisStorage(STORAGE_KEYS.ACTIVE_GAME_ID, id);
      if (!berhasil) setPenyimpananTersedia(false);
      setSesiPembagian(null);
      const target = daftarGame.find((g) => g.id === id);
      if (target) {
        tampilkanToast(`Game aktif diganti ke "${target.judul}".`, 'sukses');
      }
    },
    [daftarGame, tampilkanToast]
  );

  const tambahGameBaru = useCallback(
    (judul: string, mapel: string, namaSekolah: string): Game => {
      const sekarang = Date.now();
      const gameBaru: Game = {
        id: buatId('game'),
        judul: judul.trim() || 'Game Kuis Baru',
        mapel: mapel.trim() || 'Umum',
        namaSekolah: namaSekolah.trim(),
        soal: [],
        pengaturan: buatPengaturanDefault(),
        status: 'draf',
        dibuatPada: sekarang,
        diubahPada: sekarang,
      };
      setDaftarGame((prev) => simpanDaftarKeStorage([gameBaru, ...prev]));
      setGameAktifId(gameBaru.id);
      tulisStorage(STORAGE_KEYS.ACTIVE_GAME_ID, gameBaru.id);
      setSesiPembagian(null);
      tampilkanToast(`Game "${gameBaru.judul}" berhasil dibuat.`, 'sukses');
      return gameBaru;
    },
    [simpanDaftarKeStorage, tampilkanToast]
  );

  const simpanSoalKeGameAktif = useCallback(
    (
      identitas: IdentitasGameInput,
      soalList: Soal[],
      mode: 'ganti' | 'tambah',
      status: 'draf' | 'siap' = 'siap'
    ): Game => {
      const targetId = gameAktif.id;
      const soalGabungan = mode === 'tambah' ? [...gameAktif.soal, ...soalList] : [...soalList];
      const gameTerbaru: Game = {
        ...gameAktif,
        judul: identitas.judul.trim() || gameAktif.judul,
        mapel: identitas.mapel.trim() || gameAktif.mapel,
        namaSekolah: identitas.namaSekolah.trim(),
        soal: soalGabungan,
        status,
        diubahPada: Date.now(),
      };

      setDaftarGame((prev) => {
        const ada = prev.some((g) => g.id === targetId);
        const berikutnya = ada
          ? prev.map((g) => (g.id === targetId ? gameTerbaru : g))
          : [gameTerbaru, ...prev];
        return simpanDaftarKeStorage(berikutnya);
      });

      setGameAktifId(targetId);
      tulisStorage(STORAGE_KEYS.ACTIVE_GAME_ID, targetId);
      return gameTerbaru;
    },
    [gameAktif, simpanDaftarKeStorage]
  );

  const buatGameDenganSoal = useCallback(
    (
      identitas: IdentitasGameInput,
      soalList: Soal[],
      status: 'draf' | 'siap' = 'draf'
    ): Game => {
      const sekarang = Date.now();
      const gameBaru: Game = {
        id: buatId('game'),
        judul: identitas.judul.trim() || 'Game Kuis Baru',
        mapel: identitas.mapel.trim() || 'Umum',
        namaSekolah: identitas.namaSekolah.trim(),
        soal: [...soalList],
        pengaturan: buatPengaturanDefault(),
        status,
        dibuatPada: sekarang,
        diubahPada: sekarang,
      };
      setDaftarGame((prev) => simpanDaftarKeStorage([gameBaru, ...prev]));
      setGameAktifId(gameBaru.id);
      tulisStorage(STORAGE_KEYS.ACTIVE_GAME_ID, gameBaru.id);
      return gameBaru;
    },
    [simpanDaftarKeStorage]
  );

  const duplikasiGame = useCallback(
    (id: string): Game | null => {
      const sumber = daftarGame.find((g) => g.id === id);
      if (!sumber) return null;
      const sekarang = Date.now();
      const salinan: Game = {
        ...sumber,
        id: buatId('game'),
        judul: `${sumber.judul} (Salinan)`,
        soal: sumber.soal.map((s) => ({ ...s, id: buatId('soal'), pilihan: [...s.pilihan] })),
        pengaturan: {
          ...sumber.pengaturan,
          namaTim: [...sumber.pengaturan.namaTim],
          anggota: sumber.pengaturan.anggota.map((a) => [...a]),
        },
        dibuatPada: sekarang,
        diubahPada: sekarang,
      };
      setDaftarGame((prev) => simpanDaftarKeStorage([salinan, ...prev]));
      setGameAktifId(salinan.id);
      tulisStorage(STORAGE_KEYS.ACTIVE_GAME_ID, salinan.id);
      setSesiPembagian(null);
      tampilkanToast(`Game "${sumber.judul}" berhasil diduplikasi.`, 'sukses');
      return salinan;
    },
    [daftarGame, simpanDaftarKeStorage, tampilkanToast]
  );

  const ubahNamaGame = useCallback(
    (
      id: string,
      judulBaru: string,
      mapelBaru?: string,
      namaSekolahBaru?: string
    ): Game | null => {
      const target = daftarGame.find((g) => g.id === id);
      if (!target) return null;
      const judulBersih = judulBaru.trim() || target.judul;
      const terbarui: Game = {
        ...target,
        judul: judulBersih,
        mapel: mapelBaru !== undefined ? mapelBaru.trim() || target.mapel : target.mapel,
        namaSekolah:
          namaSekolahBaru !== undefined ? namaSekolahBaru.trim() : target.namaSekolah,
        diubahPada: Date.now(),
      };
      setDaftarGame((prev) =>
        simpanDaftarKeStorage(prev.map((g) => (g.id === id ? terbarui : g)))
      );
      tampilkanToast(`Nama game diubah menjadi "${terbarui.judul}".`, 'sukses');
      return terbarui;
    },
    [daftarGame, simpanDaftarKeStorage, tampilkanToast]
  );

  const imporGameDariPaket = useCallback(
    (
      gamePaket: Game,
      strategi: 'simpan_baru' | 'timpa',
      targetTimpaId?: string
    ): Game => {
      const sekarang = Date.now();
      const idTarget =
        strategi === 'timpa' && targetTimpaId
          ? targetTimpaId
          : strategi === 'timpa'
            ? gamePaket.id
            : buatId('game');

      const gameFinal: Game = {
        ...gamePaket,
        id: idTarget,
        soal: gamePaket.soal.map((s) => ({ ...s, pilihan: [...s.pilihan] })),
        pengaturan: {
          ...gamePaket.pengaturan,
          namaTim: [...gamePaket.pengaturan.namaTim],
          anggota: gamePaket.pengaturan.anggota.map((a) => [...a]),
        },
        dibuatPada: strategi === 'simpan_baru' ? sekarang : gamePaket.dibuatPada || sekarang,
        diubahPada: sekarang,
      };

      setDaftarGame((prev) => {
        const adaTarget = strategi === 'timpa' && prev.some((g) => g.id === idTarget);
        const berikutnya = adaTarget
          ? prev.map((g) => (g.id === idTarget ? gameFinal : g))
          : [gameFinal, ...prev];
        return simpanDaftarKeStorage(berikutnya);
      });

      setGameAktifId(gameFinal.id);
      tulisStorage(STORAGE_KEYS.ACTIVE_GAME_ID, gameFinal.id);
      setSesiPembagian(null);
      setSesiMode(null);
      hapusSesiModeSessionStorage();
      tampilkanToast(`Game "${gameFinal.judul}" berhasil diimpor ke Game Saya.`, 'sukses');
      return gameFinal;
    },
    [simpanDaftarKeStorage, tampilkanToast]
  );

  const hapusGame = useCallback(
    (id: string) => {
      setDaftarGame((prev) => {
        const sisa = prev.filter((g) => g.id !== id);
        const berikutnya = sisa.length > 0 ? sisa : [buatContohGameBawaan()];
        const terurut = simpanDaftarKeStorage(berikutnya);
        if (gameAktifId === id || !terurut.some((g) => g.id === gameAktifId)) {
          setGameAktifId(terurut[0].id);
          tulisStorage(STORAGE_KEYS.ACTIVE_GAME_ID, terurut[0].id);
        }
        return terurut;
      });
      setSesiPembagian(null);
      tampilkanToast('Game berhasil dihapus.', 'info');
    },
    [gameAktifId, simpanDaftarKeStorage, tampilkanToast]
  );

  const perbaruiPengaturanGameAktif = useCallback(
    (pengaturanBaru: Pengaturan, identitas?: Partial<IdentitasGameInput>): Game => {
      const gameTerbaru: Game = {
        ...gameAktif,
        judul: identitas?.judul !== undefined ? identitas.judul.trim() || gameAktif.judul : gameAktif.judul,
        mapel: identitas?.mapel !== undefined ? identitas.mapel.trim() || gameAktif.mapel : gameAktif.mapel,
        namaSekolah:
          identitas?.namaSekolah !== undefined ? identitas.namaSekolah.trim() : gameAktif.namaSekolah,
        pengaturan: pengaturanBaru,
        status: 'siap',
        diubahPada: Date.now(),
      };

      setDaftarGame((prev) =>
        simpanDaftarKeStorage(prev.map((g) => (g.id === gameAktif.id ? gameTerbaru : g)))
      );
      tampilkanToast('Pengaturan pertandingan berhasil disimpan.', 'sukses');
      return gameTerbaru;
    },
    [gameAktif, simpanDaftarKeStorage, tampilkanToast]
  );

  const bangunSesiLaga = useCallback(
    (
      gameSumber: Game,
      nomorLaga: number,
      terpakaiSebelumnya: string[],
      pasanganDuel: [string, string][]
    ): SesiPembagianPertandingan => {
      const perkiraan = hitungPerkiraanKebutuhanSoal(gameSumber.pengaturan, gameSumber.soal.length);
      const jumlahPerTim =
        gameSumber.pengaturan.akhirPermainan === 'soalHabis'
          ? Math.max(1, Math.floor(gameSumber.soal.length / 2))
          : Math.min(Math.max(5, Math.floor(gameSumber.soal.length / 2)), perkiraan.soalPerTimPerLaga);

      const hasilBagi = bagiSoalPertandingan(
        gameSumber.soal,
        terpakaiSebelumnya,
        jumlahPerTim,
        5
      );

      if (hasilBagi.bankDiacakUlang) {
        tampilkanToast(
          'Soal di bank sudah habis terpakai. Sistem mengacak ulang soal dari awal.',
          'peringatan'
        );
      }

      const detail = tentukanDetailLaga(gameSumber.pengaturan, nomorLaga, pasanganDuel);
      const jumlahGiliran = Math.max(8, hasilBagi.dekKiriSiswa.length);

      return {
        gameId: gameSumber.id,
        nomorLaga,
        labelLaga: detail.labelLaga,
        namaTimKiri: detail.namaTimKiri,
        namaTimKanan: detail.namaTimKanan,
        urutanPemainKiri: buatUrutanEstafet(
          detail.anggotaKiri,
          gameSumber.pengaturan.jumlahPenarik,
          jumlahGiliran
        ),
        urutanPemainKanan: buatUrutanEstafet(
          detail.anggotaKanan,
          gameSumber.pengaturan.jumlahPenarik,
          jumlahGiliran
        ),
        dekKiriSiswa: hasilBagi.dekKiriSiswa,
        dekKananSiswa: hasilBagi.dekKananSiswa,
        cadanganSiswa: hasilBagi.cadanganSiswa,
        ringkasanKiri: hasilBagi.ringkasanKiri,
        ringkasanKanan: hasilBagi.ringkasanKanan,
        terpakaiIds: hasilBagi.terpakaiIdsSesudah,
        bankDiacakUlang: hasilBagi.bankDiacakUlang,
        pasanganDuel,
      };
    },
    [tampilkanToast]
  );

  const mulaiSesiPembagian = useCallback(
    (gameSumber?: Game, pasanganDuelInput?: [string, string][]): SesiPembagianPertandingan => {
      const target = gameSumber ?? gameAktif;
      const pasangan =
        pasanganDuelInput && pasanganDuelInput.length > 0
          ? pasanganDuelInput
          : target.pengaturan.mode === '1lawan1'
            ? undiPasanganDuel([
                ...(target.pengaturan.anggota[0] ?? []),
                ...(target.pengaturan.anggota[1] ?? []),
              ])
            : [];

      const sesiBaru = bangunSesiLaga(target, 1, [], pasangan);
      setSesiPembagian(sesiBaru);
      catatRiwayatDibuka({
        judul: target.judul,
        kode: ambilKodeOnlineTersimpanUntukGame(target.id) ?? undefined,
        mapel: target.mapel,
        jumlahSoal: target.soal.length,
        lokalGameId: target.id,
      });
      return sesiBaru;
    },
    [bangunSesiLaga, gameAktif]
  );

  const siapkanLagaBerikutnya = useCallback(() => {
    const nomorBerikutnya = (sesiPembagian?.nomorLaga ?? 0) + 1;
    const terpakai = sesiPembagian?.terpakaiIds ?? [];
    const pasangan = sesiPembagian?.pasanganDuel ?? [];
    const sesiBaru = bangunSesiLaga(gameAktif, nomorBerikutnya, terpakai, pasangan);
    setSesiPembagian(sesiBaru);
  }, [bangunSesiLaga, gameAktif, sesiPembagian]);

  const mulaiSesiTurnamenBaru = useCallback(
    (gameSumber?: Game): SesiModeAktif => {
      const target = gameSumber ?? gameAktif;
      const sesiBaru = buatSesiTurnamen(target);
      setSesiMode(sesiBaru);
      simpanSesiModeSessionStorage(sesiBaru);
      catatRiwayatDibuka({
        judul: target.judul,
        kode: ambilKodeOnlineTersimpanUntukGame(target.id) ?? undefined,
        mapel: target.mapel,
        jumlahSoal: target.soal.length,
        lokalGameId: target.id,
      });
      return sesiBaru;
    },
    [gameAktif]
  );

  const mulaiSesiDuelBaru = useCallback(
    (gameSumber?: Game, pasanganInput?: PasanganDuelTerundi[]): SesiModeAktif => {
      const target = gameSumber ?? gameAktif;
      const pasanganPakai =
        pasanganInput && pasanganInput.length > 0
          ? pasanganInput
          : buatPasanganDuelDenganTanda(
              [...(target.pengaturan.anggota[0] ?? []), ...(target.pengaturan.anggota[1] ?? [])].length >= 2
                ? [...(target.pengaturan.anggota[0] ?? []), ...(target.pengaturan.anggota[1] ?? [])]
                : [target.pengaturan.namaTim[0] || 'Pemain 1', target.pengaturan.namaTim[1] || 'Pemain 2']
            );
      const sesiBaru = buatSesiDuel(target, pasanganPakai);
      setSesiMode(sesiBaru);
      simpanSesiModeSessionStorage(sesiBaru);
      catatRiwayatDibuka({
        judul: target.judul,
        kode: ambilKodeOnlineTersimpanUntukGame(target.id) ?? undefined,
        mapel: target.mapel,
        jumlahSoal: target.soal.length,
        lokalGameId: target.id,
      });
      return sesiBaru;
    },
    [gameAktif]
  );

  const siapkanLagaDariSesiMode = useCallback((): SesiPembagianPertandingan | null => {
    if (!sesiMode) return null;
    const targetGame =
      daftarGame.find((g) => g.id === sesiMode.gameId) ?? gameAktif;
    const { sesiTerbaru, pembagian } = siapkanDekLagaBerikutnya(sesiMode, targetGame);

    if (pembagian.bankDiacakUlang) {
      tampilkanToast(
        'Soal di bank sudah habis terpakai. Sistem mengacak ulang soal dari awal.',
        'peringatan'
      );
    }

    setSesiMode(sesiTerbaru);
    simpanSesiModeSessionStorage(sesiTerbaru);

    const sesiUntukMain: SesiPembagianPertandingan = {
      ...pembagian,
      pasanganDuel:
        sesiTerbaru.duel?.daftarDuel.map((p) => [p.kiri, p.kanan] as [string, string]) ?? [],
    };
    setSesiPembagian(sesiUntukMain);
    return sesiUntukMain;
  }, [daftarGame, gameAktif, sesiMode, tampilkanToast]);

  const catatLagaSelesaiKeSesiMode = useCallback(
    (match: MatchState): SesiModeAktif | null => {
      if (!sesiMode || sesiMode.gameId !== match.gameId) {
        return null;
      }
      const sesiBaru = catatHasilLagaKeSesi(sesiMode, match);
      setSesiMode(sesiBaru);
      simpanSesiModeSessionStorage(sesiBaru);
      return sesiBaru;
    },
    [sesiMode]
  );

  const akhiriDuelSekarang = useCallback((): SesiModeAktif | null => {
    if (!sesiMode) return null;
    const sesiBaru = akhiriSesiDuelManual(sesiMode);
    setSesiMode(sesiBaru);
    simpanSesiModeSessionStorage(sesiBaru);
    return sesiBaru;
  }, [sesiMode]);

  const resetSesiMode = useCallback(() => {
    setSesiMode(null);
    hapusSesiModeSessionStorage();
  }, []);

  const pulihkanContohGame = useCallback(() => {
    const contoh = buatContohGameBawaan();
    setDaftarGame((prev) => {
      const tanpaContoh = prev.filter((g) => g.id !== contoh.id);
      return simpanDaftarKeStorage([contoh, ...tanpaContoh]);
    });
    setGameAktifId(contoh.id);
    tulisStorage(STORAGE_KEYS.ACTIVE_GAME_ID, contoh.id);
    setSesiPembagian(null);
    tampilkanToast('Contoh Game bawaan (16 soal) dipulihkan.', 'sukses');
  }, [simpanDaftarKeStorage, tampilkanToast]);

  const value = useMemo<AppStoreValue>(
    () => ({
      daftarGame,
      gameAktif,
      penyimpananTersedia,
      daftarToast,
      hasilSesi,
      sesiPembagian,
      sesiMode,
      pinEditTerbukaId,
      bukaIzinEditDenganPin,
      tutupIzinEditPin,
      pilihGameAktif,
      tambahGameBaru,
      simpanSoalKeGameAktif,
      buatGameDenganSoal,
      duplikasiGame,
      ubahNamaGame,
      imporGameDariPaket,
      hapusGame,
      perbaruiPengaturanGameAktif,
      mulaiSesiPembagian,
      mulaiSesiTurnamenBaru,
      mulaiSesiDuelBaru,
      siapkanLagaDariSesiMode,
      catatLagaSelesaiKeSesiMode,
      akhiriDuelSekarang,
      resetSesiMode,
      siapkanLagaBerikutnya,
      pulihkanContohGame,
      setHasilSesi,
      tampilkanToast,
      hapusToast,
    }),
    [
      daftarGame,
      gameAktif,
      penyimpananTersedia,
      daftarToast,
      hasilSesi,
      sesiPembagian,
      sesiMode,
      pinEditTerbukaId,
      bukaIzinEditDenganPin,
      tutupIzinEditPin,
      pilihGameAktif,
      tambahGameBaru,
      simpanSoalKeGameAktif,
      buatGameDenganSoal,
      duplikasiGame,
      ubahNamaGame,
      imporGameDariPaket,
      hapusGame,
      perbaruiPengaturanGameAktif,
      mulaiSesiPembagian,
      mulaiSesiTurnamenBaru,
      mulaiSesiDuelBaru,
      siapkanLagaDariSesiMode,
      catatLagaSelesaiKeSesiMode,
      akhiriDuelSekarang,
      resetSesiMode,
      siapkanLagaBerikutnya,
      pulihkanContohGame,
      tampilkanToast,
      hapusToast,
    ]
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
};

export function useAppStore(): AppStoreValue {
  const ctx = useContext(AppStoreContext);
  if (!ctx) {
    throw new Error('useAppStore harus digunakan di dalam AppStoreProvider');
  }
  return ctx;
}
