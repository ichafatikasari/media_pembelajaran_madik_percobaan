import { ModePermainan, Soal } from '../data/types';
import { RiwayatTarikanMatch } from '../engine/match';

export interface DataLagaCsv {
  labelLaga: string;
  namaTimKiri: string;
  namaTimKanan: string;
  riwayat: readonly RiwayatTarikanMatch[];
}

function escapeCsvCell(nilai: string | number | boolean): string {
  const teks = String(nilai);
  if (/[",\r\n]/.test(teks)) {
    return `"${teks.replace(/"/g, '""')}"`;
  }
  return teks;
}

function labelMode(mode: ModePermainan): string {
  if (mode === '4tim') return '4 Tim (Turnamen)';
  if (mode === '1lawan1') return '1 Lawan 1 (Duel)';
  return '2 Tim';
}

/**
 * Menghasilkan konten CSV ber-UTF-8 BOM agar Excel membuka huruf Indonesia dengan benar.
 * Kolom: mode, pertandingan, tim, pemain, soal, jawaban benar/salah, waktu.
 */
export function buatCsvRekap(
  judulGame: string,
  mode: ModePermainan,
  daftarLaga: readonly DataLagaCsv[],
  bankSoal: readonly Soal[]
): string {
  const petaSoal = new Map<string, Soal>();
  for (const s of bankSoal) {
    petaSoal.set(s.id, s);
  }

  const header = [
    'Judul Game',
    'Mode',
    'Pertandingan',
    'Urutan',
    'Tim',
    'Pemain',
    'Soal',
    'Jawaban Dipilih',
    'Status (Benar/Salah)',
    'Perubahan Tali',
    'Posisi Tali Sesudah',
    'Waktu (detik)',
  ];

  const baris: string[] = [header.map(escapeCsvCell).join(',')];
  const teksMode = labelMode(mode);

  for (const laga of daftarLaga) {
    if (laga.riwayat.length === 0) {
      baris.push(
        [
          judulGame,
          teksMode,
          laga.labelLaga,
          0,
          `${laga.namaTimKiri} vs ${laga.namaTimKanan}`,
          '-',
          'Belum ada jawaban tercatat',
          '-',
          '-',
          0,
          0,
          0,
        ]
          .map(escapeCsvCell)
          .join(',')
      );
      continue;
    }

    for (const r of laga.riwayat) {
      const soalObj = petaSoal.get(r.soalId);
      const teksSoal = soalObj?.pertanyaan ?? (r.soalId === '-' ? 'Koreksi Manual Guru' : r.soalId);
      const namaTim = r.tim === 'merah' ? laga.namaTimKiri : laga.namaTimKanan;
      const jawabanTeks =
        r.pilihanDipilih !== null && soalObj?.pilihan[r.pilihanDipilih]
          ? `${String.fromCharCode(65 + r.pilihanDipilih)}. ${soalObj.pilihan[r.pilihanDipilih]}`
          : r.jenis === 'waktuHabis'
            ? 'Waktu Habis'
            : r.jenis === 'manual'
              ? 'Manual'
              : '-';
      const statusTeks =
        r.jenis === 'manual'
          ? 'Manual'
          : r.jenis === 'waktuHabis'
            ? 'Salah (Waktu Habis)'
            : r.benar
              ? r.jenis === 'bonus'
                ? 'Benar (Bonus x2)'
                : 'Benar'
              : 'Salah';

      baris.push(
        [
          judulGame,
          teksMode,
          laga.labelLaga,
          r.urutan,
          namaTim,
          r.pemain,
          teksSoal,
          jawabanTeks,
          statusTeks,
          r.perubahanLangkah,
          r.posisiTaliSesudah,
          r.waktuDetik,
        ]
          .map(escapeCsvCell)
          .join(',')
      );
    }
  }

  return '\uFEFF' + baris.join('\r\n');
}

export function unduhCsvRekap(namaFile: string, kontenCsv: string): void {
  const isiDenganBom = kontenCsv.startsWith('\uFEFF') ? kontenCsv : `\uFEFF${kontenCsv}`;
  const blob = new Blob([isiDenganBom], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const tautan = document.createElement('a');
  tautan.href = url;
  tautan.download = namaFile;
  document.body.appendChild(tautan);
  tautan.click();
  document.body.removeChild(tautan);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
