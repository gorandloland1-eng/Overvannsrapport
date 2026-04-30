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

export default function CalculationSection({
  form,
  setField,
  onGenerate,
  loading,
  error,
  onReset,
  validationErrors = {},
}: Props) {
  const areaError = validationErrors.area && (!form.area || Number(form.area) <= 0);
  const climateError = validationErrors.climateFactor && (!form.climateFactor || Number(form.climateFactor) <= 0);

  return (
    <section>
      <div className="grid grid-cols-2 gap-4">
        {/* Areal */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Areal (ha)
          </label>
          <input
            type="number"
            step="0.0001"
            value={form.area}
            onChange={(e) => setField("area", e.target.value)}
            placeholder="0.0000"
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
