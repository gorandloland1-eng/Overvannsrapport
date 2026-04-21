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
  return (
    <section>
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
          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
              Soil type
            </label>
            <select
              value={form.selectedSoilType}
              onChange={(e) => setField("selectedSoilType", e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
            >
              <option value="">Select soil type...</option>
              {soilTypes.map((jt) => (
                <option key={jt.id} value={jt.id}>
                  {jt.navn} — {jt.beskrivelse} (k = {jt.k_m_s} m/s)
                </option>
              ))}
            </select>
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
              (parseFloat(form.bottomArea) * 0.5 + parseFloat(form.sideArea) * 1.0) *
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