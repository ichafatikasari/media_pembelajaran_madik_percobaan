import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type JenisToast = 'sukses' | 'info' | 'peringatan' | 'error';

export interface ItemToast {
  id: string;
  pesan: string;
  jenis: JenisToast;
}

interface ToastContainerProps {
  daftarToast: ItemToast[];
  onTutup: (id: string) => void;
}

const GAYA_TOAST: Record<JenisToast, { bg: string; border: string; icon: React.ReactNode }> = {
  sukses: {
    bg: 'bg-[#008E3A]',
    border: 'border-[#57E893]',
    icon: <CheckCircle2 size={24} className="shrink-0 text-[#FFD400]" />,
  },
  info: {
    bg: 'bg-[#173287]',
    border: 'border-[#669BFF]',
    icon: <Info size={24} className="shrink-0 text-[#FFD400]" />,
  },
  peringatan: {
    bg: 'bg-[#C56200]',
    border: 'border-[#FFD400]',
    icon: <AlertCircle size={24} className="shrink-0 text-[#FFD400]" />,
  },
  error: {
    bg: 'bg-[#B80023]',
    border: 'border-[#FF6B86]',
    icon: <AlertCircle size={24} className="shrink-0 text-white" />,
  },
};

export const ToastContainer: React.FC<ToastContainerProps> = ({ daftarToast, onTutup }) => {
  if (daftarToast.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute top-24 right-8 z-[80] flex w-[460px] flex-col gap-3">
      {daftarToast.map((item) => {
        const gaya = GAYA_TOAST[item.jenis];
        return (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto flex items-center justify-between gap-3 rounded-2xl border-3 px-5 py-3.5 text-white shadow-[0_8px_0_rgba(0,0,0,0.4)] ${gaya.bg} ${gaya.border}`}
          >
            <div className="flex items-center gap-3">
              {gaya.icon}
              <p className="text-bacaan text-base font-bold">{item.pesan}</p>
            </div>
            <button
              type="button"
              onClick={() => onTutup(item.id)}
              aria-label="Tutup notifikasi"
              className="flex min-h-[48px] min-w-[48px] shrink-0 cursor-pointer items-center justify-center rounded-xl bg-black/25 text-white hover:bg-black/40"
            >
              <X size={20} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
