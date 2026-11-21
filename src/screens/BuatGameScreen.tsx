import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  Copy,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  FileUp,
  Keyboard,
  ListChecks,
  Plus,
  PlusSquare,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '../app/store';
import { Button3D } from '../components/Button3D';
import { PanelKeypadPin } from '../components/PinGuruModal';
import { PratinjauSoalPanel } from '../components/PratinjauSoalPanel';
import { RuteHash, Soal, TingkatSoal } from '../data/types';
import {
  CONTOH_FORMAT_TEKS,
  DraftSoal,
  konversiDraftValidKeSoal,
  parseFileDokumen,
  parseTeksSoal,
  soalKeDraft,
  unduhContohFormatTeks,
  unduhTemplateExcel,
} from '../parsers';
import { buatId } from '../utils/id';

interface BuatGameScreenProps {
  onNavigasi: (rute: RuteHash) => void;
}

type TabBuatGame = 'manual' | 'tempel' | 'unggah' | 'pratinjau';

interface FormManualState {
  editId: string | null;
  pertanyaan: string;
  kode: string;
  tampilkanKode: boolean;
  pilihan: string[];
  kunci: number;
  penjelasan: string;
  tingkat: '' | TingkatSoal;
  topik: string;
  bonus: boolean;
}

function buatFormManualKosong(): FormManualState {
  return {
    editId: null,
    pertanyaan: '',
    kode: '',
    tampilkanKode: false,
    pilihan: ['', '', '', ''],
    kunci: 0,
    penjelasan: '',
    tingkat: '',
    topik: '',
    bonus: false,
  };
}

export const BuatGameScreen: React.FC<BuatGameScreenProps> = ({ onNavigasi }) => {
  const {
    gameAktif,
    pinEditTerbukaId,
    bukaIzinEditDenganPin,
    tambahGameBaru,
    simpanSoalKeGameAktif,
    tampilkanToast,
  } = useAppStore();

  const pinAktif = (gameAktif.pengaturan.pinGuru ?? '').trim();
  const terkunciPin = pinAktif.length > 0 && pinEditTerbukaId !== gameAktif.id;

  const [tabAktif, setTabAktif] = useState<TabBuatGame>('manual');

  // Identitas game aktif
  const [judul, setJudul] = useState(gameAktif.judul);
  const [mapel, setMapel] = useState(gameAktif.mapel);
  const [namaSekolah, setNamaSekolah] = useState(gameAktif.namaSekolah);

  useEffect(() => {
    setJudul(gameAktif.judul);
    setMapel(gameAktif.mapel);
    setNamaSekolah(gameAktif.namaSekolah);
  }, [gameAktif.id, gameAktif.judul, gameAktif.mapel, gameAktif.namaSekolah]);

  // State A: Input Manual
  const [formManual, setFormManual] = useState<FormManualState>(() => buatFormManualKosong());
  const inputPertanyaanRef = useRef<HTMLTextAreaElement | null>(null);

  // State B: Tempel Teks
  const [teksTempel, setTeksTempel] = useState('');

  // State C: Unggah Dokumen
  const [sedangMembacaFile, setSedangMembacaFile] = useState(false);
  const [namaFileTerakhir, setNamaFileTerakhir] = useState('');
  const [peringatanDokumen, setPeringatanDokumen] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // State D: Pratinjau & Validasi
  const [draftPratinjau, setDraftPratinjau] = useState<DraftSoal[]>([]);
  const [peringatanPratinjau, setPeringatanPratinjau] = useState<string[]>([]);

  // Pembacaan live untuk Tempel Teks
  const hasilTempelLive = useMemo(() => {
    if (!teksTempel.trim()) {
      return null;
    }
    return parseTeksSoal(teksTempel, 'teks');
  }, [teksTempel]);

  const handleBuatGameKosongBaru = () => {
    const baru = tambahGameBaru(
      'Game Kuis Baru',
      'Umum',
      namaSekolah || 'Sekolah Indonesia'
    );
    setJudul(baru.judul);
    setMapel(baru.mapel);
    setNamaSekolah(baru.namaSekolah);
    setFormManual(buatFormManualKosong());
    setDraftPratinjau([]);
  };

  // === Handler Tab A: Manual ===
  const simpanFormManual = (e: React.FormEvent) => {
    e.preventDefault();
    const pertanyaanBersih = formManual.pertanyaan.trim();
    const pilihanBersih = formManual.pilihan.map((p) => p.trim());

    if (!pertanyaanBersih) {
      tampilkanToast('Pertanyaan tidak boleh kosong.', 'peringatan');
      return;
    }

    if (pilihanBersih.some((p) => !p) || pilihanBersih.length < 2) {
      tampilkanToast('Minimal 2 pilihan jawaban dan semua pilihan yang tampil harus diisi.', 'peringatan');
      return;
    }

    if (formManual.kunci < 0 || formManual.kunci >= pilihanBersih.length) {
      tampilkanToast('Pilih satu kunci jawaban yang benar.', 'peringatan');
      return;
    }

    const soalBaru: Soal = {
      id: formManual.editId ?? buatId('soal'),
      pertanyaan: pertanyaanBersih,
      ...(formManual.tampilkanKode && formManual.kode.trim()
        ? { kode: formManual.kode }
        : {}),
      pilihan: pilihanBersih,
      kunci: formManual.kunci,
      ...(formManual.penjelasan.trim() ? { penjelasan: formManual.penjelasan.trim() } : {}),
      ...(formManual.tingkat ? { tingkat: formManual.tingkat } : {}),
      ...(formManual.topik.trim() ? { topik: formManual.topik.trim() } : {}),
      ...(formManual.bonus ? { bonus: true } : {}),
    };

    const daftarBerikutnya = formManual.editId
      ? gameAktif.soal.map((s) => (s.id === formManual.editId ? soalBaru : s))
      : [...gameAktif.soal, soalBaru];

    simpanSoalKeGameAktif(
      { judul, mapel, namaSekolah },
      daftarBerikutnya,
      'ganti',
      gameAktif.status ?? 'draf'
    );

    tampilkanToast(
      formManual.editId
        ? 'Perubahan soal berhasil disimpan.'
        : 'Soal disimpan! Silakan ketik soal berikutnya.',
      'sukses'
    );
    setFormManual(buatFormManualKosong());
    inputPertanyaanRef.current?.focus();
  };

  const editSoalManual = (soal: Soal) => {
    setFormManual({
      editId: soal.id,
      pertanyaan: soal.pertanyaan,
      kode: soal.kode ?? '',
      tampilkanKode: Boolean(soal.kode),
      pilihan: soal.pilihan.length >= 2 ? [...soal.pilihan] : ['', ''],
      kunci: soal.kunci,
      penjelasan: soal.penjelasan ?? '',
      tingkat: soal.tingkat ?? '',
      topik: soal.topik ?? '',
      bonus: Boolean(soal.bonus),
    });
    setTabAktif('manual');
  };

  const duplikasiSoal = (indeks: number) => {
    const asal = gameAktif.soal[indeks];
    if (!asal) return;
    const salinan: Soal = {
      ...asal,
      id: buatId('soal'),
      pilihan: [...asal.pilihan],
    };
    const berikutnya = [...gameAktif.soal];
    berikutnya.splice(indeks + 1, 0, salinan);
    simpanSoalKeGameAktif({ judul, mapel, namaSekolah }, berikutnya, 'ganti', gameAktif.status);
    tampilkanToast('Soal berhasil diduplikasi.', 'sukses');
  };

  const hapusSoalDiBank = (indeks: number) => {
    const berikutnya = gameAktif.soal.filter((_, i) => i !== indeks);
    simpanSoalKeGameAktif({ judul, mapel, namaSekolah }, berikutnya, 'ganti', gameAktif.status);
    tampilkanToast('Soal dihapus dari bank game.', 'info');
  };

  const geserSoalDiBank = (indeks: number, arah: -1 | 1) => {
    const target = indeks + arah;
    if (target < 0 || target >= gameAktif.soal.length) return;
    const berikutnya = [...gameAktif.soal];
    const tmp = berikutnya[indeks];
    berikutnya[indeks] = berikutnya[target];
    berikutnya[target] = tmp;
    simpanSoalKeGameAktif({ judul, mapel, namaSekolah }, berikutnya, 'ganti', gameAktif.status);
  };

  // === Handler Tab B: Tempel Teks ===
  const kirimTempelKePratinjau = () => {
    if (!hasilTempelLive || hasilTempelLive.totalSoal === 0) {
      tampilkanToast('Tidak ada soal yang terbaca dari teks yang ditempel.', 'peringatan');
      return;
    }
    setDraftPratinjau(hasilTempelLive.daftar);
    setPeringatanPratinjau(hasilTempelLive.peringatanUmum);
    setTabAktif('pratinjau');
  };

  // === Handler Tab C: Unggah Dokumen ===
  const handlePilihFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSedangMembacaFile(true);
    setNamaFileTerakhir(file.name);
    setPeringatanDokumen([]);

    try {
      const hasil = await parseFileDokumen(file);
      setDraftPratinjau(hasil.daftar);
      setPeringatanPratinjau(hasil.peringatanUmum);
      setPeringatanDokumen(hasil.peringatanUmum);

      if (hasil.totalSoal > 0) {
        tampilkanToast(
          `Terbaca ${hasil.totalSoal} soal dari "${file.name}".`,
          hasil.jumlahBermasalah > 0 ? 'peringatan' : 'sukses'
        );
        setTabAktif('pratinjau');
      } else {
        tampilkanToast(
          hasil.peringatanUmum[0] || 'Belum ada soal yang dapat diekstrak dari berkas ini.',
          'peringatan'
        );
      }
    } finally {
      setSedangMembacaFile(false);
      e.target.value = '';
    }
  };

  // === Handler Tab D: Pratinjau ===
  const handleGabungDraftKeGame = (draft: DraftSoal[]) => {
    const { soalValid, jumlahDilewati } = konversiDraftValidKeSoal(draft);
    if (soalValid.length === 0) {
      tampilkanToast(
        'Belum ada soal valid yang dapat dimasukkan. Perbaiki dulu soal yang bertanda merah.',
        'peringatan'
      );
      return;
    }

    simpanSoalKeGameAktif({ judul, mapel, namaSekolah }, soalValid, 'tambah', 'draf');
    setDraftPratinjau([]);
    setPeringatanPratinjau([]);

    tampilkanToast(
      jumlahDilewati > 0
        ? `${soalValid.length} soal ditambahkan ke game. ${jumlahDilewati} soal bermasalah dilewati.`
        : `${soalValid.length} soal berhasil ditambahkan ke bank game.`,
      jumlahDilewati > 0 ? 'peringatan' : 'sukses'
    );
  };

  const handleLanjutKePengaturan = (draftDariPratinjau?: DraftSoal[]) => {
    if (draftDariPratinjau && draftDariPratinjau.length > 0) {
      const { soalValid, jumlahDilewati } = konversiDraftValidKeSoal(draftDariPratinjau);
      if (soalValid.length > 0) {
        simpanSoalKeGameAktif({ judul, mapel, namaSekolah }, soalValid, 'tambah', 'draf');
        setDraftPratinjau([]);
        if (jumlahDilewati > 0) {
          tampilkanToast(
            `Game disimpan sebagai Draf (${soalValid.length} soal masuk, ${jumlahDilewati} soal bermasalah dilewati).`,
            'peringatan'
          );
        } else {
          tampilkanToast(`Game disimpan sebagai Draf dengan ${soalValid.length} soal baru.`, 'sukses');
        }
      } else {
        simpanSoalKeGameAktif({ judul, mapel, namaSekolah }, gameAktif.soal, 'ganti', 'draf');
        tampilkanToast(
          'Soal bermasalah di pratinjau tidak dimasukkan. Identitas game tetap disimpan sebagai Draf.',
          'peringatan'
        );
      }
    } else {
      simpanSoalKeGameAktif({ judul, mapel, namaSekolah }, gameAktif.soal, 'ganti', 'draf');
      tampilkanToast('Game disimpan sebagai Draf di Game Saya.', 'sukses');
    }
    onNavigasi('/pengaturan');
  };

  const bukaBankGameDiPratinjau = () => {
    const dariBank = gameAktif.soal.map((s) => soalKeDraft(s, 'manual'));
    setDraftPratinjau(dariBank);
    setPeringatanPratinjau([]);
    setTabAktif('pratinjau');
  };

  if (terkunciPin) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#0B1B4D] px-8 py-6">
        <div className="kartu-3d w-full max-w-[560px] rounded-3xl border-4 border-[#FFD400] bg-[#12276B] p-7">
          <h1 className="font-display mb-2 text-center text-2xl font-bold text-[#FFD400]">
            Bank Soal Dilindungi PIN Guru
          </h1>
          <PanelKeypadPin
            judulKeterangan={`Masukkan PIN Guru (4 angka) untuk mengubah soal atau melihat kunci pada "${gameAktif.judul}", atau buat game baru tanpa PIN.`}
            pinBenar={pinAktif}
            labelTombolBuka="Buka Editor"
            onBerhasil={() => bukaIzinEditDenganPin(gameAktif.id)}
            onBatal={() => onNavigasi('/game-saya')}
            aksiTambahanLabel="Buat Game Baru"
            onAksiTambahan={handleBuatGameKosongBaru}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-4 bg-[#0B1B4D] px-8 py-5">
      {/* Bar Identitas Game & Aksi Cepat */}
      <div className="grid shrink-0 grid-cols-12 items-center gap-3 rounded-2xl border-3 border-[#2A4CB8] bg-[#12276B] px-5 py-3 shadow-[0_6px_0_#071236]">
        <div className="col-span-4">
          <label className="block text-xs font-bold text-[#FFD400]">Judul Game</label>
          <input
            type="text"
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
            placeholder="Judul Kuis"
            className="mt-0.5 min-h-[42px] w-full rounded-xl border-2 border-[#3C62D4] bg-[#071236] px-3 text-base font-bold text-white focus:border-[#FFD400] focus:outline-none"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-bold text-[#FFD400]">Mata Pelajaran</label>
          <input
            type="text"
            value={mapel}
            onChange={(e) => setMapel(e.target.value)}
            placeholder="Semua Mapel"
            className="mt-0.5 min-h-[42px] w-full rounded-xl border-2 border-[#3C62D4] bg-[#071236] px-3 text-base font-bold text-white focus:border-[#FFD400] focus:outline-none"
          />
        </div>
        <div className="col-span-3">
          <label className="block text-xs font-bold text-[#FFD400]">Nama Sekolah / Kelas</label>
          <input
            type="text"
            value={namaSekolah}
            onChange={(e) => setNamaSekolah(e.target.value)}
            placeholder="Nama Sekolah"
            className="mt-0.5 min-h-[42px] w-full rounded-xl border-2 border-[#3C62D4] bg-[#071236] px-3 text-base font-bold text-white focus:border-[#FFD400] focus:outline-none"
          />
        </div>
        <div className="col-span-3 flex items-end justify-end gap-2 pt-3">
          <Button3D variant="oranye" size="sm" onClick={handleBuatGameKosongBaru}>
            <PlusSquare size={18} />
            <span>Game Baru</span>
          </Button3D>
          <Button3D variant="hijau" size="sm" onClick={() => handleLanjutKePengaturan()}>
            <span>LANJUT KE PENGATURAN</span>
            <ArrowRight size={18} />
          </Button3D>
        </div>
      </div>

      {/* Tab Cara Input Soal */}
      <div className="flex shrink-0 items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Button3D
            variant={tabAktif === 'manual' ? 'kuning' : 'navy'}
            size="sm"
            onClick={() => setTabAktif('manual')}
          >
            <Keyboard size={18} />
            <span>1. Input Manual</span>
          </Button3D>
          <Button3D
            variant={tabAktif === 'tempel' ? 'kuning' : 'navy'}
            size="sm"
            onClick={() => setTabAktif('tempel')}
          >
            <FileText size={18} />
            <span>2. Tempel Teks</span>
          </Button3D>
          <Button3D
            variant={tabAktif === 'unggah' ? 'kuning' : 'navy'}
            size="sm"
            onClick={() => setTabAktif('unggah')}
          >
            <FileUp size={18} />
            <span>3. Unggah Dokumen</span>
          </Button3D>
          <Button3D
            variant={tabAktif === 'pratinjau' ? 'kuning' : 'ungu'}
            size="sm"
            onClick={() => setTabAktif('pratinjau')}
          >
            <ListChecks size={18} />
            <span>Pratinjau & Validasi ({draftPratinjau.length})</span>
          </Button3D>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-display text-base font-bold text-[#DCE7FF]">
            Bank Game Ini: <strong className="tabular-angka text-[#FFD400]">{gameAktif.soal.length} Soal</strong>
          </span>
          {gameAktif.soal.length > 0 && (
            <Button3D variant="navy" size="sm" onClick={bukaBankGameDiPratinjau}>
              <span>Edit di Pratinjau</span>
            </Button3D>
          )}
        </div>
      </div>

      {/* Konten Tab */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {/* TAB A: INPUT MANUAL */}
        {tabAktif === 'manual' && (
          <div className="grid h-full grid-cols-12 gap-5">
            {/* Form Cepat Kiri */}
            <form
              onSubmit={simpanFormManual}
              className="scroll-guru col-span-7 flex flex-col justify-between gap-3 rounded-3xl border-4 border-[#2A4CB8] bg-[#12276B] p-5 shadow-[0_8px_0_#071236]"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl font-bold text-[#FFD400]">
                    {formManual.editId ? 'Edit Soal Terpilih' : 'Form Input Cepat'}
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setFormManual((f) => ({ ...f, tampilkanKode: !f.tampilkanKode }))
                      }
                      className="cursor-pointer rounded-xl border-2 border-[#3C62D4] bg-[#071236] px-3 py-1.5 text-xs font-bold text-[#DCE7FF] hover:border-[#FFD400]"
                    >
                      {formManual.tampilkanKode ? 'Sembunyikan Blok Kode' : '+ Blok Kode (Opsional)'}
                    </button>
                    {formManual.editId && (
                      <button
                        type="button"
                        onClick={() => setFormManual(buatFormManualKosong())}
                        className="cursor-pointer rounded-xl bg-[#B80023] px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Batal Edit
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  ref={inputPertanyaanRef}
                  rows={2}
                  value={formManual.pertanyaan}
                  onChange={(e) => setFormManual({ ...formManual, pertanyaan: e.target.value })}
                  placeholder="Tulis pertanyaan di sini... (Tab untuk pindah kolom)"
                  className="w-full rounded-2xl border-2 border-[#3C62D4] bg-[#071236] px-4 py-2.5 text-base font-bold text-white placeholder-[#7FA0E8] focus:border-[#FFD400] focus:outline-none"
                />

                {formManual.tampilkanKode && (
                  <textarea
                    rows={3}
                    value={formManual.kode}
                    onChange={(e) => setFormManual({ ...formManual, kode: e.target.value })}
                    placeholder="Tempel blok kode program di sini..."
                    className="w-full rounded-2xl border-2 border-[#3C62D4] bg-[#040B24] px-4 py-2 font-mono text-sm text-[#57E893] placeholder-[#4B709E] focus:border-[#FFD400] focus:outline-none"
                  />
                )}

                {/* Pilihan A-D (2..4 pilihan) & Klik Kunci */}
                <div className="grid grid-cols-2 gap-2.5">
                  {formManual.pilihan.map((opsi, idx) => {
                    const huruf = String.fromCharCode(65 + idx);
                    const adalahKunci = formManual.kunci === idx;
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setFormManual({ ...formManual, kunci: idx })}
                          title={`Jadikan ${huruf} sebagai kunci benar`}
                          className={`font-display flex min-h-[48px] min-w-[48px] shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 text-lg font-bold ${
                            adalahKunci
                              ? 'border-[#57E893] bg-[#00C853] text-white shadow-[0_3px_0_#008E3A]'
                              : 'border-[#3C62D4] bg-[#071236] text-[#FFD400]'
                          }`}
                        >
                          {adalahKunci ? <Check size={22} strokeWidth={3} /> : huruf}
                        </button>
                        <input
                          type="text"
                          value={opsi}
                          onChange={(e) => {
                            const salinan = [...formManual.pilihan];
                            salinan[idx] = e.target.value;
                            setFormManual({ ...formManual, pilihan: salinan });
                          }}
                          placeholder={`Pilihan ${huruf}`}
                          className="min-h-[48px] flex-1 rounded-xl border-2 border-[#3C62D4] bg-[#071236] px-3.5 text-base font-semibold text-white placeholder-[#7FA0E8] focus:border-[#FFD400] focus:outline-none"
                        />
                        {formManual.pilihan.length > 2 && (
                          <button
                            type="button"
                            onClick={() => {
                              const salinan = formManual.pilihan.filter((_, pIdx) => pIdx !== idx);
                              let kunciBaru = formManual.kunci;
                              if (kunciBaru === idx) kunciBaru = 0;
                              else if (kunciBaru > idx) kunciBaru -= 1;
                              setFormManual({ ...formManual, pilihan: salinan, kunci: kunciBaru });
                            }}
                            aria-label={`Kurangi pilihan ${huruf}`}
                            className="flex min-h-[48px] min-w-[40px] shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#071236] font-bold text-[#FF6B86] hover:bg-[#7A0018]"
                          >
                            −
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {formManual.pilihan.length < 4 && (
                    <button
                      type="button"
                      onClick={() =>
                        setFormManual({
                          ...formManual,
                          pilihan: [...formManual.pilihan, ''],
                        })
                      }
                      className="font-display flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#669BFF] bg-[#071236] text-base font-bold text-[#DCE7FF] hover:border-[#FFD400] hover:text-[#FFD400]"
                    >
                      <Plus size={18} />
                      <span>Tambah Pilihan {String.fromCharCode(65 + formManual.pilihan.length)}</span>
                    </button>
                  )}
                </div>

                {/* Kolom Opsional */}
                <div className="grid grid-cols-12 gap-2.5">
                  <input
                    type="text"
                    value={formManual.penjelasan}
                    onChange={(e) => setFormManual({ ...formManual, penjelasan: e.target.value })}
                    placeholder="Penjelasan / pembahasan (opsional)"
                    className="col-span-5 min-h-[46px] rounded-xl border-2 border-[#3C62D4] bg-[#071236] px-3.5 text-sm font-semibold text-white placeholder-[#7FA0E8] focus:border-[#FFD400] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={formManual.topik}
                    onChange={(e) => setFormManual({ ...formManual, topik: e.target.value })}
                    placeholder="Topik (opsional)"
                    className="col-span-3 min-h-[46px] rounded-xl border-2 border-[#3C62D4] bg-[#071236] px-3.5 text-sm font-semibold text-white placeholder-[#7FA0E8] focus:border-[#FFD400] focus:outline-none"
                  />
                  <select
                    value={formManual.tingkat}
                    onChange={(e) =>
                      setFormManual({ ...formManual, tingkat: e.target.value as '' | TingkatSoal })
                    }
                    className="col-span-2 min-h-[46px] rounded-xl border-2 border-[#3C62D4] bg-[#071236] px-2.5 text-sm font-bold text-white focus:border-[#FFD400] focus:outline-none"
                  >
                    <option value="">Tingkat</option>
                    <option value="Mudah">Mudah</option>
                    <option value="Sedang">Sedang</option>
                    <option value="Sulit">Sulit</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setFormManual({ ...formManual, bonus: !formManual.bonus })}
                    className={`font-display col-span-2 min-h-[46px] cursor-pointer rounded-xl border-2 text-sm font-bold ${
                      formManual.bonus
                        ? 'border-[#FFE875] bg-[#FF9100] text-white'
                        : 'border-[#3C62D4] bg-[#071236] text-[#DCE7FF]'
                    }`}
                  >
                    {formManual.bonus ? 'Bonus 2× ✓' : 'Bonus 2×'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between border-t-2 border-[#223F9C] pt-3">
                <span className="text-sm font-semibold text-[#DCE7FF]">
                  Klik huruf A–D di kiri pilihan untuk menetapkan kunci benar.
                </span>
                <Button3D type="submit" variant="hijau" size="md">
                  <Plus size={20} />
                  <span>
                    {formManual.editId ? 'Simpan Perubahan' : 'Simpan & tambah soal berikutnya'}
                  </span>
                </Button3D>
              </div>
            </form>

            {/* Daftar Soal di Bank Game Kanan */}
            <div className="col-span-5 flex min-h-0 flex-col rounded-3xl border-4 border-[#3C62D4] bg-[#12276B] p-5 shadow-[0_8px_0_#071236]">
              <div className="mb-3 flex shrink-0 items-center justify-between">
                <h2 className="font-display text-xl font-bold text-[#FFD400]">
                  Daftar Soal di Game ({gameAktif.soal.length})
                </h2>
                <span className="text-xs font-bold text-[#DCE7FF]">Urutkan dengan Naik/Turun</span>
              </div>

              {gameAktif.soal.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-[#3C62D4] bg-[#071236] p-6 text-center text-base text-[#DCE7FF]">
                  Belum ada soal di game ini. Isi form di kiri atau impor dari Tempel Teks / Dokumen.
                </div>
              ) : (
                <div className="scroll-guru flex-1 space-y-2.5 pr-1">
                  {gameAktif.soal.map((soal, idx) => (
                    <div
                      key={soal.id}
                      className="flex items-start justify-between gap-2 rounded-2xl border-2 border-[#2A4CB8] bg-[#071236] p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#FFD400]">
                          <span>#{idx + 1}</span>
                          <span>· Kunci: {String.fromCharCode(65 + soal.kunci)}</span>
                          {soal.bonus && <span className="text-[#FF9100]">· BONUS 2×</span>}
                        </div>
                        <p className="truncate text-sm font-bold text-white">{soal.pertanyaan}</p>
                        <p className="truncate text-xs text-[#DCE7FF]">
                          {soal.pilihan.map((p, i) => `${String.fromCharCode(65 + i)}. ${p}`).join(' | ')}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => geserSoalDiBank(idx, -1)}
                          disabled={idx === 0}
                          aria-label={`Naikkan soal ${idx + 1}`}
                          className="flex min-h-[38px] min-w-[38px] cursor-pointer items-center justify-center rounded-lg bg-[#173287] text-white disabled:opacity-35"
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => geserSoalDiBank(idx, 1)}
                          disabled={idx === gameAktif.soal.length - 1}
                          aria-label={`Turunkan soal ${idx + 1}`}
                          className="flex min-h-[38px] min-w-[38px] cursor-pointer items-center justify-center rounded-lg bg-[#173287] text-white disabled:opacity-35"
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => editSoalManual(soal)}
                          aria-label={`Edit soal ${idx + 1}`}
                          className="flex min-h-[38px] min-w-[38px] cursor-pointer items-center justify-center rounded-lg bg-[#1E6BFF] text-white"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => duplikasiSoal(idx)}
                          aria-label={`Duplikasi soal ${idx + 1}`}
                          className="flex min-h-[38px] min-w-[38px] cursor-pointer items-center justify-center rounded-lg bg-[#7C4DFF] text-white"
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => hapusSoalDiBank(idx)}
                          aria-label={`Hapus soal ${idx + 1}`}
                          className="flex min-h-[38px] min-w-[38px] cursor-pointer items-center justify-center rounded-lg bg-[#B80023] text-white"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB B: TEMPEL TEKS */}
        {tabAktif === 'tempel' && (
          <div className="grid h-full grid-cols-12 gap-5">
            <div className="col-span-7 flex min-h-0 flex-col gap-3 rounded-3xl border-4 border-[#2A4CB8] bg-[#12276B] p-5 shadow-[0_8px_0_#071236]">
              <div className="flex shrink-0 items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-bold text-[#FFD400]">
                    Tempel Soal & Kunci Jawaban
                  </h2>
                  <p className="text-sm text-[#DCE7FF]">
                    Mendukung gaya 1. / 1) / No. 1, pilihan A. / a) / (A), Kunci:, tanda *, ✓, blok kode ```, dan daftar kunci di akhir.
                  </p>
                </div>
                <Button3D
                  variant="oranye"
                  size="sm"
                  onClick={() => setTeksTempel(CONTOH_FORMAT_TEKS)}
                >
                  <span>Lihat contoh format</span>
                </Button3D>
              </div>

              <textarea
                value={teksTempel}
                onChange={(e) => setTeksTempel(e.target.value)}
                placeholder="Tempel teks soal Anda di sini..."
                className="scroll-guru min-h-0 flex-1 resize-none rounded-2xl border-3 border-[#3C62D4] bg-[#071236] p-4 font-mono text-sm leading-relaxed text-white placeholder-[#7FA0E8] focus:border-[#FFD400] focus:outline-none"
              />
            </div>

            <div className="col-span-5 flex min-h-0 flex-col justify-between rounded-3xl border-4 border-[#3C62D4] bg-[#173287] p-5 shadow-[0_8px_0_#071236]">
              <div className="min-h-0 flex-1 overflow-hidden">
                <h3 className="font-display mb-2 text-xl font-bold text-[#FFD400]">
                  Pembacaan Otomatis Langsung
                </h3>
                {!hasilTempelLive ? (
                  <p className="text-bacaan text-base text-[#DCE7FF]">
                    Tempel soal di kotak sebelah kiri atau klik <strong>Lihat contoh format</strong> untuk langsung melihat hasil pembacaan sistem.
                  </p>
                ) : (
                  <div className="flex h-[calc(100%-36px)] flex-col gap-3">
                    <div className="rounded-2xl border-2 border-[#3C62D4] bg-[#071236] p-4">
                      <div className="font-display text-2xl font-bold text-white">
                        Terbaca {hasilTempelLive.totalSoal} soal •{' '}
                        {hasilTempelLive.jumlahBermasalah > 0 ? (
                          <span className="text-[#FF6B86]">
                            {hasilTempelLive.jumlahBermasalah} perlu diperbaiki
                          </span>
                        ) : (
                          <span className="text-[#57E893]">Semua siap</span>
                        )}
                      </div>
                    </div>

                    <div className="scroll-guru flex-1 space-y-2 pr-1">
                      {hasilTempelLive.daftar.map((d, idx) => (
                        <div
                          key={d.id}
                          className={`rounded-xl border-2 px-3.5 py-2.5 text-sm ${
                            d.masalah.length > 0
                              ? 'border-[#FF1744] bg-[#450B1C]'
                              : 'border-[#2A4CB8] bg-[#071236]'
                          }`}
                        >
                          <div className="font-bold text-[#FFD400]">
                            #{idx + 1} · {d.pilihan.length} pilihan ·{' '}
                            {d.kunci !== null ? 'Kunci terbaca' : 'Tanpa kunci'}
                            {d.kode ? ' · Ada blok kode' : ''}
                          </div>
                          <div className="truncate font-semibold text-white">{d.pertanyaan}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 flex shrink-0 flex-col gap-2.5 pt-3">
                <Button3D
                  variant="hijau"
                  size="lg"
                  fullWidth
                  disabled={!hasilTempelLive || hasilTempelLive.totalSoal === 0}
                  onClick={kirimTempelKePratinjau}
                >
                  <ListChecks size={22} />
                  <span>Buka Pratinjau & Validasi</span>
                </Button3D>
              </div>
            </div>
          </div>
        )}

        {/* TAB C: UNGGAH DOKUMEN */}
        {tabAktif === 'unggah' && (
          <div className="grid h-full grid-cols-12 gap-5">
            <div className="col-span-7 flex flex-col justify-between rounded-3xl border-4 border-[#2A4CB8] bg-[#12276B] p-6 shadow-[0_8px_0_#071236]">
              <div>
                <h2 className="font-display mb-2 text-2xl font-bold text-[#FFD400]">
                  Unggah Berkas Soal (Offline di Browser)
                </h2>
                <p className="text-bacaan mb-5 text-base text-[#DCE7FF]">
                  Pilih berkas Word (.docx), Excel (.xlsx / .xls / .csv), PDF berisi teks (.pdf), atau Teks (.txt). Tidak dikirim ke server mana pun.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,.xlsx,.xls,.csv,.pdf,.txt"
                  onChange={handlePilihFile}
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center rounded-3xl border-4 border-dashed border-[#669BFF] bg-[#071236] p-8 text-center">
                  <FileUp size={48} className="mb-3 text-[#FFD400]" />
                  <p className="font-display mb-4 text-xl font-bold text-white">
                    {sedangMembacaFile
                      ? `Sedang membaca "${namaFileTerakhir}"...`
                      : namaFileTerakhir
                        ? `Berkas terakhir: ${namaFileTerakhir}`
                        : 'Klik tombol di bawah untuk memilih berkas dari perangkat'}
                  </p>
                  <Button3D
                    variant="hijau"
                    size="lg"
                    disabled={sedangMembacaFile}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileUp size={22} />
                    <span>{sedangMembacaFile ? 'Memproses...' : 'Pilih Berkas Soal'}</span>
                  </Button3D>
                </div>

                {peringatanDokumen.length > 0 && (
                  <div className="mt-4 rounded-2xl border-3 border-[#FF9100] bg-[#7D3D00] p-4 text-base font-bold text-white">
                    {peringatanDokumen.map((pesan, i) => (
                      <p key={i}>{pesan}</p>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-sm font-semibold text-[#DCE7FF]">
                Tips Word (.docx): Anda dapat mencetak tebal, menggarisbawahi, atau menyorot warna pada pilihan jawaban yang benar—sistem akan mengenalinya otomatis.
              </div>
            </div>

            <div className="col-span-5 flex flex-col justify-between rounded-3xl border-4 border-[#3C62D4] bg-[#173287] p-6 shadow-[0_8px_0_#071236]">
              <div>
                <h3 className="font-display mb-2 text-2xl font-bold text-[#FFD400]">
                  Unduh Template & Contoh
                </h3>
                <p className="text-bacaan mb-5 text-base text-[#DCE7FF]">
                  Gunakan template berikut agar format langsung terbaca bersih tanpa peringatan saat diunggah kembali:
                </p>

                <div className="flex flex-col gap-4">
                  <div className="rounded-2xl border-2 border-[#3C62D4] bg-[#071236] p-4">
                    <div className="mb-2 flex items-center gap-2 font-display text-lg font-bold text-white">
                      <FileSpreadsheet size={22} className="text-[#57E893]" />
                      <span>Template Excel (.xlsx)</span>
                    </div>
                    <p className="mb-3 text-sm text-[#DCE7FF]">
                      Berisi header baku (Soal, A, B, C, D, Kunci, Penjelasan, Tingkat, Topik, Bonus) dan 3 baris contoh siap pakai.
                    </p>
                    <Button3D variant="kuning" size="md" fullWidth onClick={unduhTemplateExcel}>
                      <Download size={20} />
                      <span>UNDUH TEMPLATE EXCEL</span>
                    </Button3D>
                  </div>

                  <div className="rounded-2xl border-2 border-[#3C62D4] bg-[#071236] p-4">
                    <div className="mb-2 flex items-center gap-2 font-display text-lg font-bold text-white">
                      <FileText size={22} className="text-[#FFD400]" />
                      <span>Contoh Format Teks (.txt)</span>
                    </div>
                    <p className="mb-3 text-sm text-[#DCE7FF]">
                      Berisi beragam gaya nomor soal, pilihan A–D, blok kode, dan pola kunci jawaban.
                    </p>
                    <Button3D variant="biru" size="md" fullWidth onClick={unduhContohFormatTeks}>
                      <Download size={20} />
                      <span>UNDUH CONTOH FORMAT TEKS</span>
                    </Button3D>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB D: PRATINJAU & VALIDASI */}
        {tabAktif === 'pratinjau' && (
          <PratinjauSoalPanel
            draftList={draftPratinjau}
            peringatanUmum={peringatanPratinjau}
            jumlahSoalDiBankGame={gameAktif.soal.length}
            onUpdateDraftList={setDraftPratinjau}
            onGabungKeGame={handleGabungDraftKeGame}
            onLanjutPengaturan={handleLanjutKePengaturan}
          />
        )}
      </div>
    </div>
  );
};
