import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

type Props = {
  form: any;
  setField: (field: string, value: string) => void;
  onGenerate: () => void;
  loading: boolean;
  error: string;
  onReset: () => void;
  validationErrors?: {
    area?: string;
    climateFactor?: string;
  };
};

const RETURN_PERIOD_OPTIONS = [
  { value: "2",   label: "2 år" },
  { value: "5",   label: "5 år" },
  { value: "10",  label: "10 år" },
  { value: "20",  label: "20 år" },
  { value: "25",  label: "25 år" },
  { value: "50",  label: "50 år" },
  { value: "100", label: "100 år" },
  { value: "200", label: "200 år" },
];

export default function CalculationSection({
  form,
  setField,
  onGenerate,
  loading,
  error,
  onReset,
  validationErrors = {},
}: Props) {
  const [returnPeriodOpen, setReturnPeriodOpen] = useState(false);
  const returnPeriodRef = useRef<HTMLDivElement | null>(null);

  const selectedReturnPeriod =
    RETURN_PERIOD_OPTIONS.find((opt) => opt.value === form.returnPeriod) ??
    RETURN_PERIOD_OPTIONS[0];

  const areaError = validationErrors.area && (!form.area || Number(form.area) <= 0);
  const climateError = validationErrors.climateFactor && (!form.climateFactor || Number(form.climateFactor) <= 0);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!returnPeriodRef.current?.contains(e.target as Node)) {
        setReturnPeriodOpen(false);
      }
    }
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <section>
      <div className="grid grid-cols-2 gap-4">
        {/* Areal */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Areal
          </label>
          <input
            type="number"
            value={form.area}
            onChange={(e) => setField("area", e.target.value)}
            placeholder="200"
            className={`h-12 w-full rounded-[22px] border bg-white px-5 text-base text-slate-900 outline-none focus:ring-4 dark:bg-slate-900 dark:text-slate-100 ${
              areaError
                ? "border-red-400 focus:border-red-400 focus:ring-red-100 dark:border-red-500 dark:focus:ring-red-900/30"
                : "border-slate-200 focus:border-slate-300 focus:ring-slate-200 dark:border-slate-700 dark:focus:ring-slate-700"
            }`}
          />
          {areaError && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{validationErrors.area}</p>
          )}
        </div>

        {/* Returperiode */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Returperiode
          </label>
          <div className="relative z-10" ref={returnPeriodRef}>
            <button
              type="button"
              onClick={() => setReturnPeriodOpen((prev) => !prev)}
              className="flex h-12 w-full items-center justify-between rounded-[22px] border border-slate-200 bg-white px-5 text-base text-slate-900 outline-none transition focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
              aria-haspopup="listbox"
              aria-expanded={returnPeriodOpen}
            >
              <span>{selectedReturnPeriod.label}</span>
              <ChevronDown
                size={20}
                strokeWidth={2.2}
                className={`shrink-0 text-slate-700 transition-transform dark:text-slate-200 ${returnPeriodOpen ? "rotate-180" : ""}`}
              />
            </button>

            {returnPeriodOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {RETURN_PERIOD_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => { setField("returnPeriod", option.value); setReturnPeriodOpen(false); }}
                    className={`block w-full px-4 py-2.5 text-left text-sm transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800 ${
                      form.returnPeriod === option.value ? "bg-slate-100 dark:bg-slate-800" : ""
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Klimafaktor */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Klimafaktor
          </label>
          <input
            type="number"
            step="0.1"
            value={form.climateFactor}
            onChange={(e) => setField("climateFactor", e.target.value)}
            placeholder="1.0"
            className={`h-12 w-full rounded-[22px] border bg-white px-5 text-base text-slate-900 outline-none focus:ring-4 dark:bg-slate-900 dark:text-slate-100 ${
              climateError
                ? "border-red-400 focus:border-red-400 focus:ring-red-100 dark:border-red-500 dark:focus:ring-red-900/30"
                : "border-slate-200 focus:border-slate-300 focus:ring-slate-200 dark:border-slate-700 dark:focus:ring-slate-700"
            }`}
          />
          {climateError && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{validationErrors.climateFactor}</p>
          )}
        </div>

      </div>

      {error && (
        <div className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</div>
      )}

      <div className="space-y-3 pt-4">
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading}
          className="h-14 w-full rounded-[16px] bg-[#213F53] text-base font-semibold text-white transition hover:bg-[#1a3244] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Genererer PDF..." : "Generer PDF"}
        </button>

        <button
          type="button"
          onClick={onReset}
          className="h-12 w-full rounded-[16px] border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Nullstill
        </button>
      </div>
    </section>
  );
}