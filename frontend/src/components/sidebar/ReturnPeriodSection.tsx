import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

type Props = {
  value: string;
  setField: (field: string, value: string) => void;
};

const RETURN_PERIOD_OPTIONS = [
  { value: "2", label: "2 år" },
  { value: "5", label: "5 år" },
  { value: "10", label: "10 år" },
  { value: "20", label: "20 år" },
  { value: "25", label: "25 år" },
  { value: "50", label: "50 år" },
  { value: "100", label: "100 år" },
  { value: "200", label: "200 år" },
];

export default function ReturnPeriodSection({ value, setField }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const selected =
    RETURN_PERIOD_OPTIONS.find((option) => option.value === value) ??
    RETURN_PERIOD_OPTIONS[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <section className="relative z-[70]">
      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
        Returperiode
      </label>

      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex h-12 w-full items-center justify-between rounded-[22px] border border-slate-200 bg-white px-5 text-base text-slate-900 outline-none transition focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span>{selected.label}</span>
          <ChevronDown
            size={20}
            strokeWidth={2.2}
            className={`shrink-0 text-slate-700 transition-transform dark:text-slate-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            {RETURN_PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setField("returnPeriod", option.value);
                  setOpen(false);
                }}
                className={`block w-full px-4 py-2.5 text-left text-sm transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800 ${
                  value === option.value ? "bg-slate-100 dark:bg-slate-800" : ""
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
