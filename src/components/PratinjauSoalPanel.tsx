import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  Plus,
  Shuffle,
  Trash2,
} from 'lucide-react';
import {
  DraftSoal,
  acakUrutanPilihanDraft,
  konversiDraftValidKeSoal,
  validasiDaftarDraftSoal,
} from '../parsers';
import { Button3D } from './Button3D';

interface PratinjauSoalPanelProps {
  draftList: DraftSoal[];
  peringatanUmum: string[];
  jumlahSoalDiBankGame: number;
  onUpdateDraftList: (berikutnya: DraftSoal[]) => void;
  onGabungKeGame: (draftList: DraftSoal[]) => void;
  onLanjutPengaturan: (draftList: DraftSoal[]) => void;
}

export const PratinjauSoalPanel: React.FC<PratinjauSoalPanelProps> = ({
  draftList,
  peringatanUmum,
  jumlahSoalDiBankGame,
  onUpdateDraftList,
  onGabungKeGame,
  onLanjutPengaturan,
}) => {
  const [tampilkanKunci, setTampilkanKunci] = useState(false);

  const hasilValidasi = validasiDaftarDraftSoal(draftList, peringatanUmum);
  const daftar = hasilValidasi.daftar;
  const { jumlahDilewati } = konversiDraftValidKeSoal(daftar);

  const updateBaris = (indeks: number, pengubah: (lama: DraftSoal) => DraftSoal) => {
    const salinan = daftar.map((item, idx) => (idx === indeks ? pengubah(item) : item));
    onUpdateDraftList(validasiDaftarDraftSoal(salinan, peringatanUmum).daftar);
  };

  const hapusBaris = (indeks: number) => {
    const salinan = daftar.filter((_, idx) => idx !== indeks);
    onUpdateDraftList(validasiDaftarDraftSoal(salinan, peringatanUmum).daftar);
  };

  const geserBaris = (indeks: number, arah: -1 | 1) => {
    const target = indeks + arah;
    if (target < 0 || target >= daftar.length) return;
    const salinan = [...daftar];
    const sementara = salinan[indeks];
    salinan[indeks] = salinan[target];
    salinan[target] = sementara;
    onUpdateDraftList(salinan);
  };

  const handleAcakSemuaPilihan = () => {
    const teracak = daftar.map(acakUrutanPilihanDraft);
    onUpdateDraftList(validasiDaftarDraftSoal(teracak, peringatanUmum).daftar);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Ringkasan & Kontrol Pratinjau */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl border-3 border-[#3C62D4] bg-[#071236] px-5 py-3">
        <div>
          <div className="font-display text-xl font-bold text-[#FFD400]">
            Terbaca {hasilValidasi.totalSoal} soal •{' '}
            {hasilValidasi.jumlahBermasalah > 0 ? (
              <span className="text-[#FF6B86]">
                {hasilValidasi.jumlahBermasalah} perlu diperbaiki
              </span>
            ) : (
              <span className="text-[#57E893]">Semua siap dipakai</span>
            )}
          </div>
          <p className="text-sm text-[#DCE7FF]">
            Bank soal game saat ini berisi <strong className="text-white">{jumlahSoalDiBankGame}</strong> soal.
            {jumlahDilewati > 0 && (
              <span className="ml-2 font-bold text-[#FFD400]">
                ({jumlahDilewati} soal bermasalah tidak akan ikut masuk ke game sebelum diperbaiki)
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button3D
            variant={tampilkanKunci ? 'hijau' : 'navy'}
            size="sm"
            onClick={() => setTampilkanKunci((v) => !v)}
          >
            {tampilkanKunci ? <Eye size={18} /> : <EyeOff size={18} />}
            <span>Tampilkan Kunci: {tampilkanKunci ? 'ON' : 'OFF'}</span>
          </Button3D>

          <Button3D
            variant="ungu"
            size="sm"
            disabled={daftar.length === 0}
            onClick={handleAcakSemuaPilihan}
          >
            <Shuffle size={18} />
            <span>Acak Urutan Pilihan</span>
          </Button3D>

          <Button3D
            variant="oranye"
            size="sm"
            disabled={daftar.length === 0}
            onClick={() => onGabungKeGame(daftar)}
          >
            <Plus size={18} />
            <span>Tambah ke Game ({daftar.length - jumlahDilewati})</span>
          </Button3D>

          <Button3D
            variant="hijau"
            size="sm"
            disabled={daftar.length === 0 && jumlahSoalDiBankGame === 0}
            onClick={() => onLanjutPengaturan(daftar)}
          >
            <span>LANJUT KE PENGATURAN</span>
            <ArrowRight size={18} />
          </Button3D>
        </div>
      </div>

      {/* Peringatan Umum Dokumen */}
      {hasilValidasi.peringatanUmum.length > 0 && (
        <div className="flex shrink-0 flex-col gap-1 rounded-2xl border-2 border-[#FFD400] bg-[#7D3D00] px-4 py-2.5 text-sm font-semibold text-white">
          {hasilValidasi.peringatanUmum.map((p, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <AlertTriangle size={18} className="shrink-0 text-[#FFD400]" />
              <span>{p}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabel Edit Inline Soal */}
      {daftar.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border-3 border-dashed border-[#3C62D4] bg-[#071236] p-8 text-center">
          <p className="text-bacaan text-xl text-[#DCE7FF]">
            Belum ada hasil baca di pratinjau. Gunakan tab <strong>Tempel Teks</strong> atau{' '}
            <strong>Unggah Dokumen</strong> untuk memuat soal ke sini.
          </p>
        </div>
      ) : (
        <div className="scroll-guru flex-1 space-y-3 pr-2">
          {daftar.map((item, idx) => {
            const adaMasalah = item.masalah.length > 0;
            return (
              <div
                key={item.id}
                className={`rounded-2xl border-3 p-4 ${
                  adaMasalah
                    ? 'border-[#FF1744] bg-[#450B1C]'
                    : 'border-[#2A4CB8] bg-[#12276B]'
                }`}
              >
                {/* Baris Atas: Nomor, Masalah, Aksi */}
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display rounded-lg bg-[#FFD400] px-2.5 py-0.5 text-sm font-bold text-[#0B1B4D]">
                      Soal #{idx + 1}
                    </span>
                    <span className="text-xs font-bold text-[#DCE7FF]">
                      Sumber: {item.sumber.toUpperCase()}
                    </span>
                    {item.peringatanDetail.map((masalah, mIdx) => (
                      <span
                        key={mIdx}
                        className="rounded-lg bg-[#FF1744] px-2.5 py-0.5 text-xs font-bold text-white"
                      >
                        {masalah}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => geserBaris(idx, -1)}
                      disabled={idx === 0}
                      aria-label={`Naikkan soal ${idx + 1}`}
                      className="flex min-h-[40px] min-w-[40px] cursor-pointer items-center justify-center rounded-xl bg-[#071236] text-white disabled:opacity-40"
                    >
                      <ArrowUp size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => geserBaris(idx, 1)}
                      disabled={idx === daftar.length - 1}
                      aria-label={`Turunkan soal ${idx + 1}`}
                      className="flex min-h-[40px] min-w-[40px] cursor-pointer items-center justify-center rounded-xl bg-[#071236] text-white disabled:opacity-40"
                    >
                      <ArrowDown size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => hapusBaris(idx)}
                      aria-label={`Hapus soal ${idx + 1}`}
                      className="flex min-h-[40px] min-w-[40px] cursor-pointer items-center justify-center rounded-xl bg-[#B80023] text-white hover:bg-[#FF1744]"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Edit Pertanyaan & Kode */}
                <div className="mb-3 grid grid-cols-12 gap-3">
                  <div className={item.kode !== undefined ? 'col-span-7' : 'col-span-12'}>
                    <input
                      type="text"
                      value={item.pertanyaan}
                      onChange={(e) =>
                        updateBaris(idx, (lama) => ({ ...lama, pertanyaan: e.target.value }))
                      }
                      placeholder="Tulis teks pertanyaan..."
                      className="min-h-[44px] w-full rounded-xl border-2 border-[#3C62D4] bg-[#071236] px-3.5 text-base font-bold text-white focus:border-[#FFD400] focus:outline-none"
                    />
                  </div>
                  {item.kode !== undefined && (
                    <div className="col-span-5">
                      <textarea
                        rows={2}
                        value={item.kode}
                        onChange={(e) =>
                          updateBaris(idx, (lama) => ({ ...lama, kode: e.target.value }))
                        }
                        placeholder="Potongan kode (monospace)..."
                        className="w-full rounded-xl border-2 border-[#3C62D4] bg-[#040B24] px-3 py-1.5 font-mono text-xs text-[#57E893] focus:border-[#FFD400] focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Edit Pilihan A-D & Kunci */}
                <div className="grid grid-cols-2 gap-2.5">
                  {item.pilihan.map((opsi, opsiIdx) => {
                    const huruf = String.fromCharCode(65 + opsiIdx);
                    const adalahKunci = item.kunci === opsiIdx;
                    const sorotKunci = tampilkanKunci && adalahKunci;

                    return (
                      <div key={opsiIdx} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateBaris(idx, (lama) => ({ ...lama, kunci: opsiIdx }))
                          }
                          title={
                            tampilkanKunci
                              ? 'Klik untuk menjadikan kunci'
                              : 'Aktifkan Tampilkan Kunci untuk melihat, atau klik untuk memilih kunci'
                          }
                          className={`font-display flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 text-base font-bold ${
                            sorotKunci
                              ? 'border-[#57E893] bg-[#00C853] text-white'
                              : 'border-[#3C62D4] bg-[#071236] text-[#FFD400]'
                          }`}
                        >
                          {sorotKunci ? <Check size={20} strokeWidth={3} /> : huruf}
                        </button>

                        <input
                          type="text"
                          value={opsi}
                          onChange={(e) =>
                            updateBaris(idx, (lama) => {
                              const pilihanBaru = [...lama.pilihan];
                              pilihanBaru[opsiIdx] = e.target.value;
                              return { ...lama, pilihan: pilihanBaru };
                            })
                          }
                          placeholder={`Pilihan ${huruf}`}
                          className="min-h-[44px] flex-1 rounded-xl border-2 border-[#3C62D4] bg-[#071236] px-3 text-sm font-semibold text-white focus:border-[#FFD400] focus:outline-none"
                        />

                        {item.pilihan.length > 2 && (
                          <button
                            type="button"
                            onClick={() =>
                              updateBaris(idx, (lama) => {
                                const pilihanBaru = lama.pilihan.filter((_, pIdx) => pIdx !== opsiIdx);
                                let kunciBaru = lama.kunci;
                                if (kunciBaru === opsiIdx) {
                                  kunciBaru = null;
                                } else if (kunciBaru !== null && kunciBaru > opsiIdx) {
                                  kunciBaru -= 1;
                                }
                                return { ...lama, pilihan: pilihanBaru, kunci: kunciBaru };
                              })
                            }
                            aria-label={`Hapus pilihan ${huruf}`}
                            className="flex min-h-[44px] min-w-[40px] shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#071236] text-xs font-bold text-[#FF6B86] hover:bg-[#7A0018]"
                          >
                            −
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {item.pilihan.length < 4 && (
                    <button
                      type="button"
                      onClick={() =>
                        updateBaris(idx, (lama) => ({
                          ...lama,
                          pilihan: [...lama.pilihan, ''],
                        }))
                      }
                      className="font-display flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#669BFF] bg-[#071236] text-sm font-bold text-[#DCE7FF] hover:border-[#FFD400] hover:text-[#FFD400]"
                    >
                      <Plus size={16} />
                      <span>Tambah Pilihan {String.fromCharCode(65 + item.pilihan.length)}</span>
                    </button>
                  )}
                </div>

                {/* Status Kunci saat mode disamarkan */}
                {!tampilkanKunci && (
                  <div className="mt-2 text-xs font-semibold text-[#DCE7FF]">
                    Kunci jawaban disamarkan ({item.kunci !== null ? 'Sudah terisi — klik Tampilkan Kunci untuk memeriksa' : 'Belum dipilih!'}).
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
