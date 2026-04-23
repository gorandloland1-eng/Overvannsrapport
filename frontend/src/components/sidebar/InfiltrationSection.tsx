import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

type SoilType = {
  id: string;
  navn: string;
  beskrivelse: string;
  k_m_s: number;
};

type Props = {
  form: any;
  setField: (field: string, value: string) => void;
  soilTypes: SoilType[];
};

export default function InfiltrationSection({
  form,
  setField,
  soilTypes,
}: Props) {
  const [soilDropdownOpen, setSoilDropdownOpen] = useState(false);
  const [soilSearch, setSoilSearch] = useState("");

  const selectedSoil = useMemo(
    () => soilTypes.find((j) => j.id === form.selectedSoilType),
    [soilTypes, form.selectedSoilType]
  );

  const filteredSoilTypes = useMemo(() => {
    const q = soilSearch.toLowerCase();
    return soilTypes.filter((jt) =>
      `${jt.navn} ${jt.beskrivelse} ${jt.k_m_s}`.toLowerCase().includes(q)
    );
  }, [soilTypes, soilSearch]);

  return (
    <section className="relative z-20">
      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
        Infiltration capacity
      </label>

      <div className="mb-3 flex overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setField("infiltrationMethod", "direct")}
          className={`flex-1 py-2 text-sm font-medium transition ${
            form.infiltrationMethod === "direct"
              ? "bg-[#213F53] text-white"
              : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          Direct Q_inf
        </button>

        <button
          type="button"
          onClick={() => setField("infiltrationMethod", "soiltype")}
          className={`flex-1 py-2 text-sm font-medium transition ${
            form.infiltrationMethod === "soiltype"
              ? "bg-[#213F53] text-white"
              : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          Soil type
        </button>
      </div>

      {form.infiltrationMethod === "direct" && (
        <div>
          <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
            Q_inf [l/s]
          </label>
          <input
            type="number"
            min="0"
            value={form.manualQInf}
            onChange={(e) => setField("manualQInf", e.target.value)}
            placeholder="0.0"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
          />
        </div>
      )}

      {form.infiltrationMethod === "soiltype" && (
        <div className="space-y-3">
          <div className="relative z-30">
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
              Soil type
            </label>

            <div className="relative">
              <input
                value={soilSearch}
                onChange={(e) => {
                  setSoilSearch(e.target.value);
                  setSoilDropdownOpen(true);
                }}
                onFocus={() => setSoilDropdownOpen(true)}
                placeholder={
                  selectedSoil
                    ? `${selectedSoil.navn} — ${selectedSoil.beskrivelse} (k = ${selectedSoil.k_m_s} m/s)`
                    : "Select soil type..."
                }
                className="h-12 w-full rounded-[22px] border border-slate-200 bg-white px-5 pr-12 text-base text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:ring-slate-700"
              />

              <button
                type="button"
                onClick={() => setSoilDropdownOpen(!soilDropdownOpen)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-700 dark:text-slate-200"
                aria-label="Open soil type dropdown"
              >
                <ChevronDown
                  size={20}
                  strokeWidth={2.2}
                  className={`transition-transform ${
                    soilDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {soilDropdownOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[9999] max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  {filteredSoilTypes.length > 0 ? (
                    filteredSoilTypes.map((jt) => (
                      <button
                        key={jt.id}
                        type="button"
                        onClick={() => {
                          setField("selectedSoilType", jt.id);
                          setSoilSearch("");
                          setSoilDropdownOpen(false);
                        }}
                        className={`block w-full px-4 py-2.5 text-left text-sm transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800 ${
                          form.selectedSoilType === jt.id
                            ? "bg-slate-100 dark:bg-slate-800"
                            : ""
                        }`}
                      >
                        {jt.navn} — {jt.beskrivelse} (k = {jt.k_m_s} m/s)
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400">
                      No soil types found
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                A_bottom [m²]
              </label>
              <input
                type="number"
                min="0"
                value={form.bottomArea}
                onChange={(e) => setField("bottomArea", e.target.value)}
                placeholder="0.0"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                A_side [m²]
              </label>
              <input
                type="number"
                min="0"
                value={form.sideArea}
                onChange={(e) => setField("sideArea", e.target.value)}
                placeholder="0.0"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
              />
            </div>
          </div>

          {form.selectedSoilType && form.bottomArea && form.sideArea && (() => {
            const jt = soilTypes.find((j) => j.id === form.selectedSoilType);
            if (!jt) return null;

            const qInf =
              jt.k_m_s *
              (parseFloat(form.bottomArea) * 0.5 +
                parseFloat(form.sideArea) * 1.0) *
              1000;

            return (
              <div className="rounded-xl border border-slate-200 bg-white/60 p-3 text-sm font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100">
                Q_inf: <span className="font-semibold">{qInf.toFixed(4)} l/s</span>
              </div>
            );
          })()}
        </div>
      )}
    </section>
  );
}