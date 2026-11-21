import React, { useEffect } from 'react';
import { Award, Download, Home, Medal, Play, Star, Trophy } from 'lucide-react';
import { useAppStore } from '../app/store';
import { ArenaTarikTambang } from '../components/ArenaTarikTambang';
import { Button3D } from '../components/Button3D';
import { MascotChibi } from '../components/MascotChibi';
import { RuteHash } from '../data/types';
import { hapusSesiMatchSessionStorage } from '../engine/match';
import { ambilPeringkatTurnamen, hapusSesiModeSessionStorage } from '../engine/session';
import { mainkanSorakMenang, tandaiInteraksiAudio } from '../utils/audio';
import { buatCsvRekap, DataLagaCsv, unduhCsvRekap } from '../utils/csvRekap';

interface HasilScreenProps {
  onNavigasi: (rute: RuteHash) => void;
}

const LABEL_ALASAN: Record<string, string> = {
  waktu: 'Waktu Permainan Habis',
  soalHabis: 'Semua Soal Selesai',
  keduanya: 'Waktu / Soal Tercapai',
  penentuan: 'Ronde Penentuan (Tiebreaker)',
};

const KONFETI_HASIL = [
  { left: '8%', warna: '#FFD400', delay: '0ms' },
  { left: '20%', warna: '#00C853', delay: '140ms' },
  { left: '34%', warna: '#FF1744', delay: '60ms' },
  { left: '50%', warna: '#29B6FF', delay: '220ms' },
  { left: '66%', warna: '#FF9100', delay: '100ms' },
  { left: '80%', warna: '#FFD400', delay: '180ms' },
  { left: '92%', warna: '#57E893', delay: '40ms' },
];

export const HasilScreen: React.FC<HasilScreenProps> = ({ onNavigasi }) => {
  const {
    gameAktif,
    hasilSesi,
    sesiMode,
    mulaiSesiPembagian,
    mulaiSesiTurnamenBaru,
    mulaiSesiDuelBaru,
    resetSesiMode,
    tampilkanToast,
  } = useAppStore();

  const namaMerah = hasilSesi.namaTimKiri || gameAktif.pengaturan.namaTim[0] || 'Tim Merah';
  const namaBiru = hasilSesi.namaTimKanan || gameAktif.pengaturan.namaTim[1] || 'Tim Biru';

  const adalahTurnamen =
    (hasilSesi.mode === '4tim' || sesiMode?.mode === '4tim') &&
    Boolean(sesiMode?.turnamen?.final.selesai);
  const adalahDuel =
    (hasilSesi.mode === '1lawan1' || sesiMode?.mode === '1lawan1') &&
    Boolean(sesiMode?.duel && sesiMode.riwayatLaga.length > 0);

  useEffect(() => {
    if (hasilSesi.totalSoalTerjawab > 0 || adalahTurnamen || adalahDuel) {
      mainkanSorakMenang();
    }
  }, [adalahDuel, adalahTurnamen, hasilSesi.totalSoalTerjawab]);

  const peringkatTurnamen =
    adalahTurnamen && sesiMode?.turnamen ? ambilPeringkatTurnamen(sesiMode.turnamen) : null;

  const judulPemenang =
    adalahTurnamen && peringkatTurnamen
      ? `JUARA 1: ${peringkatTurnamen.juara1}`
      : adalahDuel && sesiMode?.duel?.papanKemenangan[0]
        ? `JUARA DUEL: ${sesiMode.duel.papanKemenangan[0].nama}`
        : hasilSesi.pemenang === 'merah'
          ? `▲ ${namaMerah} MENANG!`
          : hasilSesi.pemenang === 'biru'
            ? `● ${namaBiru} MENANG!`
            : 'PERTANDINGAN SERI!';

  const handleMainLagi = () => {
    tandaiInteraksiAudio();
    hapusSesiMatchSessionStorage();
    hapusSesiModeSessionStorage();

    if (gameAktif.pengaturan.mode === '4tim') {
      mulaiSesiTurnamenBaru(gameAktif);
      onNavigasi('/turnamen');
      return;
    }
    if (gameAktif.pengaturan.mode === '1lawan1') {
      mulaiSesiDuelBaru(gameAktif);
      onNavigasi('/duel');
      return;
    }

    resetSesiMode();
    mulaiSesiPembagian(gameAktif);
    onNavigasi('/main');
  };

  const handleUnduhRekapCsv = () => {
    tandaiInteraksiAudio();
    const modeAktif = hasilSesi.mode ?? sesiMode?.mode ?? gameAktif.pengaturan.mode;
    let daftarLagaCsv: DataLagaCsv[] = [];

    if ((modeAktif === '4tim' || modeAktif === '1lawan1') && sesiMode && sesiMode.riwayatLaga.length > 0) {
      daftarLagaCsv = sesiMode.riwayatLaga.map((l) => ({
        labelLaga: l.labelLaga,
        namaTimKiri: l.namaTimKiri,
        namaTimKanan: l.namaTimKanan,
        riwayat: l.riwayat,
      }));
    } else {
      daftarLagaCsv = [
        {
          labelLaga: hasilSesi.labelLaga || 'Pertandingan 2 Tim',
          namaTimKiri: namaMerah,
          namaTimKanan: namaBiru,
          riwayat: hasilSesi.riwayat ?? [],
        },
      ];
    }

    const konten = buatCsvRekap(gameAktif.judul, modeAktif, daftarLagaCsv, gameAktif.soal);
    const slug = gameAktif.judul
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/(^-|-$)/g, '');
    unduhCsvRekap(`rekap-${slug || 'duel-otak'}.csv`, konten);
    tampilkanToast('File rekap CSV (UTF-8 BOM) berhasil diunduh.', 'sukses');
  };

  return (
    <div
      onPointerDown={() => tandaiInteraksiAudio()}
      className={`relative flex h-full w-full flex-col justify-between gap-3 overflow-hidden bg-[#0B1B4D] px-8 py-4 ${
        gameAktif.pengaturan.modeRekam ? 'mode-rekam-aktif' : ''
      } ${gameAktif.pengaturan.efekRingan ? 'efek-ringan-aktif' : ''}`}
    >
      {/* Konfeti Kemenangan */}
      {!gameAktif.pengaturan.efekRingan && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[220px] overflow-hidden">
          {KONFETI_HASIL.map((k, idx) => (
            <div
              key={idx}
              style={{ left: k.left, top: '0px', animationDelay: k.delay, backgroundColor: k.warna }}
              className="anim-konfeti absolute h-4 w-4 rounded-sm border-2 border-[#071236]"
            />
          ))}
        </div>
      )}

      {/* 1. Header Pemenang / Podium */}
      {adalahTurnamen && peringkatTurnamen ? (
        <div className="kartu-3d grid grid-cols-12 items-end gap-4 rounded-3xl border-4 border-[#FFD400] bg-[#12276B] px-6 py-3.5">
          {/* Juara 2 (Kiri) */}
          <div className="col-span-3 flex items-center gap-3 rounded-2xl border-3 border-[#669BFF] bg-[#071F70] px-4 py-2.5">
            <Medal size={30} className="shrink-0 text-[#DCE7FF]" />
            <div className="min-w-0">
              <div className="font-display text-xs font-bold text-[#DCE7FF]">JUARA 2 (FINALIS)</div>
              <div className="truncate font-display text-xl font-bold text-white">
                {peringkatTurnamen.juara2}
              </div>
            </div>
          </div>

          {/* Juara 1 (Tengah Lebih Tinggi) */}
          <div className="col-span-6 flex items-center justify-center gap-4 rounded-2xl border-4 border-[#FFD400] bg-[#7D3D00] px-6 py-3 shadow-[0_6px_0_#071236]">
            <MascotChibi
              varian="hijab"
              tim="merah"
              ukuran={82}
              menghadap="kanan"
              pegangTali={false}
              pose="menang"
            />
            <div className="text-center">
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#FFD400] px-3 py-0.5 font-display text-xs font-bold text-[#071236]">
                <Trophy size={14} /> JUARA 1 TURNAMEN 4 TIM
              </div>
              <h1 className="font-display teks-outline-raksasa mt-1 text-3xl font-bold text-white">
                {peringkatTurnamen.juara1}
              </h1>
              <p className="text-xs font-bold text-[#FFD400]">
                {gameAktif.judul} · Final: {namaMerah} ({hasilSesi.skorMerah}) vs {namaBiru} ({hasilSesi.skorBiru})
              </p>
            </div>
            <MascotChibi
              varian="putra"
              tim="biru"
              ukuran={82}
              menghadap="kiri"
              pegangTali={false}
              pose="menang"
            />
          </div>

          {/* Juara 3 Bersama (Kanan) */}
          <div className="col-span-3 flex items-center gap-3 rounded-2xl border-3 border-[#57E893] bg-[#005724] px-4 py-2.5">
            <Award size={30} className="shrink-0 text-[#57E893]" />
            <div className="min-w-0">
              <div className="font-display text-xs font-bold text-[#57E893]">JUARA 3 BERSAMA</div>
              <div className="truncate font-display text-base font-bold text-white">
                {peringkatTurnamen.juara3Bersama[0]} &amp; {peringkatTurnamen.juara3Bersama[1]}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="kartu-3d flex items-center justify-between gap-5 rounded-3xl border-4 border-[#FFD400] bg-[#12276B] px-6 py-3.5">
          <div className="flex items-center gap-3 rounded-2xl border-3 border-[#FF6B86] bg-[#7A0018] px-4 py-2">
            <MascotChibi
              varian="hijab"
              tim="merah"
              ukuran={74}
              menghadap="kanan"
              pegangTali={false}
              pose={hasilSesi.pemenang === 'merah' ? 'menang' : hasilSesi.pemenang === 'biru' ? 'kalah' : 'diam'}
            />
            <div>
              <h2 className="font-display text-lg font-bold text-[#FFD400]">▲ {namaMerah}</h2>
              <p className="font-display tabular-angka teks-outline-tebal text-2xl font-bold text-white">
                {hasilSesi.skorMerah} Benar · {hasilSesi.skorSalahMerah} Salah
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-3">
              <div className="anim-pop-skor relative flex h-14 w-14 items-center justify-center rounded-2xl border-3 border-[#071236] bg-[#FFD400] text-[#071236] shadow-[0_4px_0_#C79A00]">
                <Trophy size={32} strokeWidth={2.5} />
                <Star size={14} fill="#FFFFFF" className="absolute -top-1.5 -right-1.5 text-[#071236]" />
              </div>
              <div className="text-left">
                <p className="font-display text-xs font-bold text-[#57E893]">
                  {gameAktif.judul} · {LABEL_ALASAN[hasilSesi.alasanAkhir ?? ''] ?? 'Pertandingan Selesai'}
                </p>
                <h1 className="font-display teks-outline-raksasa text-3xl font-bold text-[#FFD400]">
                  {judulPemenang}
                </h1>
              </div>
            </div>
            <div className="mt-1 flex items-center gap-4 text-sm font-bold text-[#DCE7FF]">
              <span className="tabular-angka">
                Selisih Tali Akhir:{' '}
                <strong className="text-[#FFD400]">
                  {hasilSesi.posisiTaliAkhir > 0
                    ? `+${hasilSesi.posisiTaliAkhir}`
                    : hasilSesi.posisiTaliAkhir}
                </strong>
              </span>
              <span>·</span>
              <span className="tabular-angka">
                Total Soal Terjawab: <strong className="text-white">{hasilSesi.totalSoalTerjawab}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border-3 border-[#669BFF] bg-[#071F70] px-4 py-2">
            <div className="text-right">
              <h2 className="font-display text-lg font-bold text-[#FFD400]">● {namaBiru}</h2>
              <p className="font-display tabular-angka teks-outline-tebal text-2xl font-bold text-white">
                {hasilSesi.skorBiru} Benar · {hasilSesi.skorSalahBiru} Salah
              </p>
            </div>
            <MascotChibi
              varian="putra"
              tim="biru"
              ukuran={74}
              menghadap="kiri"
              pegangTali={false}
              pose={hasilSesi.pemenang === 'biru' ? 'menang' : hasilSesi.pemenang === 'merah' ? 'kalah' : 'diam'}
            />
          </div>
        </div>
      )}

      {/* 2. Arena Akhir Laga (Mode 2 Tim / Laga Terakhir) ATAU Ringkasan Laga Sesi Turnamen/Duel */}
      {adalahTurnamen && sesiMode?.turnamen ? (
        <div className="kartu-3d grid shrink-0 grid-cols-3 gap-4 rounded-3xl border-3 border-[#3C62D4] bg-[#173287] p-4">
          {[
            { judul: 'Semifinal 1', slot: sesiMode.turnamen.semifinal1 },
            { judul: 'Semifinal 2', slot: sesiMode.turnamen.semifinal2 },
            { judul: 'Final Turnamen', slot: sesiMode.turnamen.final },
          ].map((item) => (
            <div
              key={item.judul}
              className="rounded-2xl border-2 border-[#2A4CB8] bg-[#071236] px-4 py-3"
            >
              <div className="font-display text-xs font-bold text-[#FFD400]">{item.judul}</div>
              {item.slot.hasil ? (
                <>
                  <div className="mt-1 font-display text-base font-bold text-white">
                    ▲ {item.slot.hasil.namaTimKiri} ({item.slot.hasil.skorMerah}) vs ●{' '}
                    {item.slot.hasil.namaTimKanan} ({item.slot.hasil.skorBiru})
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs font-bold text-[#57E893]">
                    <span>Pemenang: {item.slot.hasil.namaPemenang}</span>
                    <span className="tabular-angka text-[#FFD400]">
                      Selisih: {item.slot.hasil.posisiTaliAkhir}
                    </span>
                  </div>
                </>
              ) : (
                <div className="mt-1 text-sm text-[#DCE7FF]">Belum tercatat</div>
              )}
            </div>
          ))}
        </div>
      ) : adalahDuel && sesiMode?.duel ? (
        <div className="kartu-3d flex h-[230px] shrink-0 flex-col rounded-3xl border-3 border-[#3C62D4] bg-[#173287] p-4">
          <h3 className="font-display mb-2 shrink-0 text-base font-bold text-[#FFD400]">
            Papan Kemenangan Sesi Duel 1 Lawan 1
          </h3>
          <div className="scroll-guru grid flex-1 grid-cols-4 gap-2.5 pr-1">
            {sesiMode.duel.papanKemenangan.map((p, idx) => (
              <div
                key={p.nama}
                className="flex flex-col justify-between rounded-2xl border-2 border-[#2A4CB8] bg-[#071236] px-3.5 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-display text-sm font-bold text-white">
                    #{idx + 1} {p.nama}
                  </span>
                  {p.mainDuaKali && (
                    <span className="rounded bg-[#FF9100] px-1.5 py-0.5 text-[10px] font-bold text-[#071236]">
                      2x
                    </span>
                  )}
                </div>
                <div className="tabular-angka mt-1 flex items-center justify-between text-xs font-bold">
                  <span className="text-[#57E893]">Menang: {p.menang}</span>
                  <span className="text-[#FF6B86]">Kalah: {p.kalah}</span>
                  <span className="text-[#FFD400]">Benar: {p.totalBenar}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <ArenaTarikTambang
          namaTimKiri={namaMerah}
          namaTimKanan={namaBiru}
          namaSekolah={gameAktif.namaSekolah}
          mapel={gameAktif.mapel}
          jumlahPenarik={gameAktif.pengaturan.jumlahPenarik}
          posisiTali={hasilSesi.posisiTaliAkhir}
          langkahKeGaris={gameAktif.pengaturan.langkahKeGaris}
          indeksGiliranKiri={0}
          indeksGiliranKanan={0}
          faseTimKiri="selesai"
          faseTimKanan="selesai"
          pemenang={hasilSesi.totalSoalTerjawab > 0 ? hasilSesi.pemenang : null}
          modeRekam={gameAktif.pengaturan.modeRekam}
          efekRingan={gameAktif.pengaturan.efekRingan}
        />
      )}

      {/* 3. Rekap Per Pemain + Tombol Aksi & UNDUH REKAP CSV */}
      <div className="kartu-3d flex min-h-0 flex-1 items-center gap-5 rounded-3xl border-3 border-[#2A4CB8] bg-[#12276B] p-4">
        <div className="flex h-full min-w-0 flex-1 flex-col">
          <h3 className="font-display mb-2 shrink-0 text-lg font-bold text-[#FFD400]">
            Rekap Per Pemain (Nama · Benar · Salah · Giliran)
          </h3>
          {hasilSesi.rekapPemain.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-base font-bold text-[#DCE7FF]">
              Belum ada statistik pemain untuk sesi ini.
            </div>
          ) : (
            <div className="scroll-guru grid flex-1 grid-cols-4 gap-2.5 pr-1">
              {hasilSesi.rekapPemain.map((p, idx) => (
                <div
                  key={`${p.tim}_${p.nama}_${idx}`}
                  className={`flex flex-col justify-between rounded-2xl border-2 px-3 py-2 ${
                    p.tim === 'merah'
                      ? 'border-[#FF6B86] bg-[#450B1C]'
                      : 'border-[#669BFF] bg-[#071F70]'
                  }`}
                >
                  <div className="font-display truncate text-sm font-bold text-white">
                    {p.tim === 'merah' ? '▲' : '●'} {p.nama}
                  </div>
                  <div className="tabular-angka mt-0.5 flex items-center justify-between text-xs font-bold text-[#DCE7FF]">
                    <span>Giliran: {p.soal}</span>
                    <span className="text-[#57E893]">Benar: {p.benar}</span>
                    <span className="text-[#FF6B86]">Salah: {p.salah}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2.5">
          <Button3D variant="ungu" size="md" onClick={handleUnduhRekapCsv}>
            <Download size={20} />
            <span>UNDUH REKAP (CSV)</span>
          </Button3D>
          <Button3D variant="hijau" size="lg" onClick={handleMainLagi}>
            <Play size={22} fill="currentColor" />
            <span>MAIN LAGI</span>
          </Button3D>
          <Button3D variant="kuning" size="md" onClick={() => onNavigasi('/')}>
            <Home size={20} />
            <span>KEMBALI KE MENU</span>
          </Button3D>
        </div>
      </div>
    </div>
  );
};
