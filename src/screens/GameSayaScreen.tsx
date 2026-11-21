import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Cloud,
  CopyPlus,
  Edit3,
  Eye,
  FileUp,
  Lock,
  Pencil,
  Play,
  PlusSquare,
  RotateCcw,
  Settings,
  Share2,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '../app/store';
import { AutoFitText } from '../components/AutoFitText';
import { BagikanGameModal } from '../components/BagikanGameModal';
import { Button3D } from '../components/Button3D';
import { ImporPaketModal } from '../components/ImporPaketModal';
import { Modal } from '../components/Modal';
import { PinGuruModal } from '../components/PinGuruModal';
import { Game, RuteHash } from '../data/types';
import { hapusSesiMatchSessionStorage } from '../engine/match';
import { hapusSesiModeSessionStorage } from '../engine/session';
import { tandaiInteraksiAudio } from '../utils/audio';

interface GameSayaScreenProps {
  onNavigasi: (rute: RuteHash) => void;
}

type AksiTertundaPin =
  | { jenis: 'panel_guru'; game: Game }
  | { jenis: 'ubah_soal'; game: Game }
  | { jenis: 'atur'; game: Game }
  | { jenis: 'ubah_nama'; game: Game }
  | { jenis: 'bagikan'; game: Game }
  | { jenis: 'hapus'; game: Game };

function formatTanggalIndonesia(timestamp?: number): string {
  if (!timestamp || !Number.isFinite(timestamp)) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleDateString('id-ID');
  }
}

export const GameSayaScreen: React.FC<GameSayaScreenProps> = ({ onNavigasi }) => {
  const {
    daftarGame,
    gameAktif,
    penyimpananTersedia,
    pilihGameAktif,
    duplikasiGame,
    ubahNamaGame,
    imporGameDariPaket,
    hapusGame,
    pulihkanContohGame,
    bukaIzinEditDenganPin,
    mulaiSesiPembagian,
    mulaiSesiTurnamenBaru,
    mulaiSesiDuelBaru,
    resetSesiMode,
    tampilkanToast,
  } = useAppStore();

  const [gameDitinjau, setGameDitinjau] = useState<Game | null>(null);
  const [gameDibagikan, setGameDibagikan] = useState<Game | null>(null);
  const [gameDiubahNama, setGameDiubahNama] = useState<Game | null>(null);
  const [gameKonfirmasiHapus, setGameKonfirmasiHapus] = useState<Game | null>(null);
  const [modalImporTerbuka, setModalImporTerbuka] = useState(false);

  const [judulEdit, setJudulEdit] = useState('');
  const [mapelEdit, setMapelEdit] = useState('');
  const [sekolahEdit, setSekolahEdit] = useState('');

  const [aksiPinTertunda, setAksiPinTertunda] = useState<AksiTertundaPin | null>(null);

  const eksekusiAksiSetelahPin = (aksi: AksiTertundaPin) => {
    const target = aksi.game;
    if (aksi.jenis === 'panel_guru') {
      setGameDitinjau(target);
    } else if (aksi.jenis === 'ubah_soal') {
      bukaIzinEditDenganPin(target.id);
      pilihGameAktif(target.id);
      onNavigasi('/buat-game');
    } else if (aksi.jenis === 'atur') {
      bukaIzinEditDenganPin(target.id);
      pilihGameAktif(target.id);
      onNavigasi('/pengaturan');
    } else if (aksi.jenis === 'ubah_nama') {
      setJudulEdit(target.judul);
      setMapelEdit(target.mapel);
      setSekolahEdit(target.namaSekolah);
      setGameDiubahNama(target);
    } else if (aksi.jenis === 'bagikan') {
      setGameDibagikan(target);
    } else if (aksi.jenis === 'hapus') {
      setGameKonfirmasiHapus(target);
    }
  };

  const jalankanDenganCekPin = (aksi: AksiTertundaPin) => {
    const pin = (aksi.game.pengaturan.pinGuru ?? '').trim();
    if (pin.length > 0) {
      setAksiPinTertunda(aksi);
    } else {
      eksekusiAksiSetelahPin(aksi);
    }
  };

  const handleMainkanGame = (game: Game) => {
    tandaiInteraksiAudio();
    pilihGameAktif(game.id);
    hapusSesiMatchSessionStorage();
    hapusSesiModeSessionStorage();
    resetSesiMode();
    if (game.pengaturan.mode === '4tim') {
      mulaiSesiTurnamenBaru(game);
      onNavigasi('/turnamen');
      return;
    }
    if (game.pengaturan.mode === '1lawan1') {
      mulaiSesiDuelBaru(game);
      onNavigasi('/duel');
      return;
    }
    mulaiSesiPembagian(game);
    onNavigasi('/main');
  };

  const handleSimpanUbahNama = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameDiubahNama) return;
    ubahNamaGame(gameDiubahNama.id, judulEdit, mapelEdit, sekolahEdit);
    setGameDiubahNama(null);
  };

  const labelKeteranganPin = aksiPinTertunda
    ? aksiPinTertunda.jenis === 'panel_guru'
      ? 'Masukkan PIN Guru (4 angka) untuk membuka Panel Guru & kunci jawaban.'
      : aksiPinTertunda.jenis === 'bagikan'
        ? 'Masukkan PIN Guru (4 angka) untuk membagikan game, link, dan QR Code.'
        : aksiPinTertunda.jenis === 'hapus'
          ? 'Masukkan PIN Guru (4 angka) sebelum menghapus game ini.'
          : 'Masukkan PIN Guru (4 angka) untuk mengubah soal atau identitas game.'
    : '';

  return (
    <div className="flex h-full w-full flex-col gap-4 bg-[#0B1B4D] px-8 py-5">
      {/* Header Layar */}
      <div className="flex shrink-0 items-center justify-between gap-4 rounded-3xl border-4 border-[#2A4CB8] bg-[#12276B] px-6 py-4 shadow-[0_8px_0_#071236]">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#FFD400]">Game Saya</h1>
          <p className="text-bacaan text-base font-bold text-[#DCE7FF]">
            Urut berdasarkan terakhir diubah · Kelola, duplikasi, ubah nama, bagikan (.json / link / QR), atau tinjau kunci di Panel Guru.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          <Button3D variant="ungu" size="md" onClick={() => onNavigasi('/online')}>
            <Cloud size={18} />
            <span>Game Online</span>
          </Button3D>
          <Button3D variant="biru" size="md" onClick={() => setModalImporTerbuka(true)}>
            <FileUp size={18} />
            <span>Impor Paket (.json)</span>
          </Button3D>
          <Button3D variant="ungu" size="md" onClick={pulihkanContohGame}>
            <RotateCcw size={18} />
            <span>Pulihkan Contoh</span>
          </Button3D>
          <Button3D variant="oranye" size="md" onClick={() => onNavigasi('/buat-game')}>
            <PlusSquare size={18} />
            <span>Buat Game</span>
          </Button3D>
        </div>
      </div>

      {/* Peringatan jika localStorage tidak tersedia */}
      {!penyimpananTersedia && (
        <div className="flex shrink-0 items-center gap-3 rounded-2xl border-3 border-[#FF9100] bg-[#4D2400] px-5 py-2.5 text-sm font-bold text-[#FFE8B3]">
          <AlertTriangle size={22} className="shrink-0 text-[#FFD400]" />
          <span>
            Penyimpanan browser tidak tersedia atau penuh (misalnya mode privat/incognito). Perubahan sementara hanya tersimpan di memori — gunakan tombol <strong>Bagikan → Unduh Paket (.json)</strong> agar soal Anda aman!
          </span>
        </div>
      )}

      {/* Daftar Game */}
      <div className="scroll-guru grid flex-1 grid-cols-2 gap-5 pr-2 pb-2">
        {daftarGame.map((game) => {
          const aktif = game.id === gameAktif.id;
          const adaPin = Boolean((game.pengaturan.pinGuru ?? '').trim());
          return (
            <div
              key={game.id}
              className={`flex flex-col justify-between rounded-3xl border-4 p-5 shadow-[0_8px_0_#071236] ${
                aktif ? 'border-[#FFD400] bg-[#173287]' : 'border-[#2A4CB8] bg-[#12276B]'
              }`}
            >
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="truncate font-display text-sm font-bold text-[#FFD400]">
                    {game.mapel}
                    {game.namaSekolah ? ` · ${game.namaSekolah}` : ''}
                    {game.status === 'draf' ? ' · DRAF' : ''}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {adaPin && (
                      <span className="font-display flex items-center gap-1 rounded-lg border border-[#FFD400] bg-[#071236] px-2.5 py-0.5 text-xs font-bold text-[#FFD400]">
                        <Lock size={12} />
                        PIN
                      </span>
                    )}
                    {aktif && (
                      <span className="font-display flex items-center gap-1 rounded-lg bg-[#00C853] px-2.5 py-0.5 text-xs font-bold text-white">
                        <Check size={14} strokeWidth={3} />
                        AKTIF
                      </span>
                    )}
                  </div>
                </div>

                <div className="h-[44px] w-full">
                  <AutoFitText maxFontSize={26} minFontSize={16} className="font-display font-bold text-white">
                    {game.judul}
                  </AutoFitText>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold text-[#DCE7FF]">
                  <span>
                    Soal: <strong className="tabular-angka text-[#FFD400]">{game.soal.length}</strong>
                  </span>
                  <span>·</span>
                  <span className="uppercase">{game.pengaturan.mode}</span>
                  <span>·</span>
                  <span className="text-xs text-[#A8C4FF]">
                    Diubah: {formatTanggalIndonesia(game.diubahPada)}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {!aktif && (
                  <Button3D variant="biru" size="sm" onClick={() => pilihGameAktif(game.id)}>
                    <Check size={16} />
                    <span>Pilih</span>
                  </Button3D>
                )}
                <Button3D
                  variant="hijau"
                  size="sm"
                  disabled={game.soal.length === 0}
                  onClick={() => handleMainkanGame(game)}
                >
                  <Play size={16} fill="currentColor" />
                  <span>Main</span>
                </Button3D>
                <Button3D
                  variant="oranye"
                  size="sm"
                  onClick={() => jalankanDenganCekPin({ jenis: 'ubah_soal', game })}
                >
                  {adaPin ? <Lock size={15} /> : <Edit3 size={16} />}
                  <span>Ubah Soal</span>
                </Button3D>
                <Button3D
                  variant="kuning"
                  size="sm"
                  onClick={() => jalankanDenganCekPin({ jenis: 'atur', game })}
                >
                  <Settings size={16} />
                  <span>Pengaturan</span>
                </Button3D>
                <Button3D
                  variant="navy"
                  size="sm"
                  onClick={() => jalankanDenganCekPin({ jenis: 'ubah_nama', game })}
                >
                  <Pencil size={15} />
                  <span>Ubah Nama</span>
                </Button3D>
                <Button3D variant="navy" size="sm" onClick={() => duplikasiGame(game.id)}>
                  <CopyPlus size={16} />
                  <span>Duplikasi</span>
                </Button3D>
                <Button3D
                  variant="ungu"
                  size="sm"
                  onClick={() => jalankanDenganCekPin({ jenis: 'bagikan', game })}
                >
                  {adaPin ? <Lock size={15} /> : <Share2 size={16} />}
                  <span>Bagikan</span>
                </Button3D>
                <Button3D
                  variant="navy"
                  size="sm"
                  onClick={() => jalankanDenganCekPin({ jenis: 'panel_guru', game })}
                >
                  {adaPin ? <Lock size={15} /> : <Eye size={16} />}
                  <span>Kunci</span>
                </Button3D>
                {daftarGame.length > 1 && (
                  <Button3D
                    variant="merah"
                    size="sm"
                    onClick={() => jalankanDenganCekPin({ jenis: 'hapus', game })}
                    aria-label={`Hapus ${game.judul}`}
                  >
                    <Trash2 size={16} />
                    <span>Hapus</span>
                  </Button3D>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal PIN Guru Ramah Sentuh 4 Angka */}
      <PinGuruModal
        terbuka={Boolean(aksiPinTertunda)}
        judul="Verifikasi PIN Guru"
        keterangan={labelKeteranganPin}
        pinBenar={(aksiPinTertunda?.game.pengaturan.pinGuru ?? '').trim()}
        onBerhasil={() => {
          if (!aksiPinTertunda) return;
          const aksi = aksiPinTertunda;
          setAksiPinTertunda(null);
          eksekusiAksiSetelahPin(aksi);
        }}
        onTutup={() => setAksiPinTertunda(null)}
      />

      {/* Modal Ubah Nama Game */}
      <Modal
        terbuka={Boolean(gameDiubahNama)}
        judul="Ubah Nama & Identitas Game"
        onTutup={() => setGameDiubahNama(null)}
        lebarMaks="md"
      >
        <form onSubmit={handleSimpanUbahNama} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="font-display text-sm font-bold text-[#FFD400]">Judul Game</span>
            <input
              type="text"
              required
              autoFocus
              value={judulEdit}
              onChange={(e) => setJudulEdit(e.target.value)}
              className="min-h-[48px] rounded-xl border-2 border-[#3C62D4] bg-[#071236] px-4 text-base font-bold text-white focus:border-[#FFD400] focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-display text-sm font-bold text-[#FFD400]">Mata Pelajaran / Kelas</span>
            <input
              type="text"
              value={mapelEdit}
              onChange={(e) => setMapelEdit(e.target.value)}
              className="min-h-[48px] rounded-xl border-2 border-[#3C62D4] bg-[#071236] px-4 text-base font-bold text-white focus:border-[#FFD400] focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-display text-sm font-bold text-[#FFD400]">Nama Sekolah (Opsional)</span>
            <input
              type="text"
              value={sekolahEdit}
              onChange={(e) => setSekolahEdit(e.target.value)}
              className="min-h-[48px] rounded-xl border-2 border-[#3C62D4] bg-[#071236] px-4 text-base font-bold text-white focus:border-[#FFD400] focus:outline-none"
            />
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button3D variant="navy" size="md" onClick={() => setGameDiubahNama(null)}>
              Batal
            </Button3D>
            <Button3D type="submit" variant="hijau" size="md">
              Simpan Perubahan
            </Button3D>
          </div>
        </form>
      </Modal>

      {/* Modal Konfirmasi Hapus Game */}
      <Modal
        terbuka={Boolean(gameKonfirmasiHapus)}
        judul="Konfirmasi Hapus Game"
        onTutup={() => setGameKonfirmasiHapus(null)}
        lebarMaks="md"
      >
        {gameKonfirmasiHapus && (
          <div className="flex flex-col gap-4">
            <p className="text-bacaan text-lg font-bold text-white">
              Yakin ingin menghapus game <span className="text-[#FFD400]">&quot;{gameKonfirmasiHapus.judul}&quot;</span> ({gameKonfirmasiHapus.soal.length} soal)?
            </p>
            <p className="text-sm font-semibold text-[#FFE8B3]">
              Tindakan ini tidak dapat dibatalkan setelah dihapus dari penyimpanan browser.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button3D variant="navy" size="md" onClick={() => setGameKonfirmasiHapus(null)}>
                Batal
              </Button3D>
              <Button3D
                variant="merah"
                size="md"
                onClick={() => {
                  hapusGame(gameKonfirmasiHapus.id);
                  setGameKonfirmasiHapus(null);
                }}
              >
                <Trash2 size={18} />
                <span>Ya, Hapus Game</span>
              </Button3D>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Bagikan (Paket .json, Link Data, QR PNG, & Bagikan Online) */}
      <BagikanGameModal
        game={gameDibagikan}
        onTutup={() => setGameDibagikan(null)}
        onToast={tampilkanToast}
        onBukaGameOnlineSaya={() => {
          setGameDibagikan(null);
          onNavigasi('/online');
        }}
      />

      {/* Modal Impor Paket .json */}
      <ImporPaketModal
        terbuka={modalImporTerbuka}
        daftarGameAda={daftarGame}
        onImporSimpan={(game, strategi, targetTimpaId) => {
          imporGameDariPaket(game, strategi, targetTimpaId);
        }}
        onTutup={() => setModalImporTerbuka(false)}
      />

      {/* Modal Panel Guru untuk meninjau soal & kunci jawaban */}
      <Modal
        terbuka={Boolean(gameDitinjau)}
        judul={gameDitinjau ? `Panel Guru: ${gameDitinjau.judul}` : 'Panel Guru'}
        onTutup={() => setGameDitinjau(null)}
        lebarMaks="xl"
        footer={
          <Button3D variant="kuning" size="md" onClick={() => setGameDitinjau(null)}>
            Tutup Panel Guru
          </Button3D>
        }
      >
        {gameDitinjau && (
          <div className="flex flex-col gap-4">
            <p className="text-bacaan text-lg text-[#FFD400]">
              Catatan: Kunci jawaban hanya ditampilkan di Panel Guru ini, tidak pernah terlihat oleh siswa saat bermain.
            </p>
            {gameDitinjau.soal.length === 0 ? (
              <div className="rounded-2xl border-2 border-[#2A4CB8] bg-[#071236] p-6 text-center text-lg text-[#DCE7FF]">
                Belum ada soal di game ini. Tambahkan soal melalui menu Buat Game.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {gameDitinjau.soal.map((soal, idx) => (
                  <div
                    key={soal.id}
                    className="rounded-2xl border-2 border-[#3C62D4] bg-[#071236] p-4"
                  >
                    <div className="mb-1 flex items-center justify-between text-sm font-bold text-[#FFD400]">
                      <span>
                        Soal {idx + 1} · {soal.topik || 'Umum'}
                      </span>
                      <span>{soal.bonus ? 'BONUS 2×' : soal.tingkat || 'Mudah'}</span>
                    </div>
                    <p className="text-bacaan mb-2 text-base font-bold text-white">
                      {soal.pertanyaan}
                    </p>
                    {soal.kode && (
                      <pre className="mb-3 overflow-x-auto rounded-xl border border-[#2A4CB8] bg-[#040B24] p-2.5 font-mono text-xs text-[#57E893]">
                        {soal.kode}
                      </pre>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {soal.pilihan.map((opsi, opsiIdx) => {
                        const adalahKunci = opsiIdx === soal.kunci;
                        return (
                          <div
                            key={`${soal.id}_${opsiIdx}`}
                            className={`rounded-xl border-2 px-3 py-1.5 font-semibold ${
                              adalahKunci
                                ? 'border-[#57E893] bg-[#008E3A] text-white'
                                : 'border-[#2A4CB8] bg-[#12276B] text-[#DCE7FF]'
                            }`}
                          >
                            {String.fromCharCode(65 + opsiIdx)}. {opsi}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
