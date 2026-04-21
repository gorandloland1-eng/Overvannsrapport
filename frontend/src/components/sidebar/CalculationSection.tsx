type Props = {
  form: any;
  setField: (field: string, value: string) => void;
  onGenerate: () => void;
  loading: boolean;
  error: string;
  onReset: () => void;
};

export default function CalculationSection({
  form,
  setField,
  onGenerate,
  loading,
  error,
  onReset,
}: Props) {
  return (
    <section>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Area
          </label>
          <input
            type="number"
            value={form.area}
            onChange={(e) => setField("area", e.target.value)}
            placeholder="200"
            className="h-12 w-full rounded-[22px] border border-slate-200 bg-white px-5 text-base text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Return period
          </label>
          <select
            value={form.returnPeriod}
            onChange={(e) => setField("returnPeriod", e.target.value)}
            className="h-12 w-full rounded-[22px] border border-slate-200 bg-white px-5 text-base text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
          >
            <option value="2">2 yr</option>
            <option value="5">5 yr</option>
            <option value="10">10 yr</option>
            <option value="20">20 yr</option>
            <option value="25">25 yr</option>
            <option value="50">50 yr</option>
            <option value="100">100 yr</option>
            <option value="200">200 yr</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Climate factor
          </label>
          <input
            type="number"
            step="0.1"
            value={form.climateFactor}
            onChange={(e) => setField("climateFactor", e.target.value)}
            placeholder="1.0"
            className="h-12 w-full rounded-[22px] border border-slate-200 bg-white px-5 text-base text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Max discharge
          </label>
          <input
            type="number"
            step="0.1"
            value={form.maxDischarge}
            onChange={(e) => setField("maxDischarge", e.target.value)}
            placeholder="0.0"
            className="h-12 w-full rounded-[22px] border border-slate-200 bg-white px-5 text-base text-slate-900 outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
          />
        </div>
      </div>

      {error && (
        <div className="mt-3 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-3 pt-4">
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading}
          className="h-14 w-full rounded-[16px] bg-slate-300 text-base font-semibold text-black transition hover:bg-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
        >
          {loading ? "Generating PDF..." : "Generate PDF"}
        </button>

        <button
          type="button"
          onClick={onReset}
          className="h-12 w-full rounded-[16px] border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Reset
        </button>
      </div>
    </section>
  );
}