type Props = {
  elevation: number | null;
  length: number | null;
  concentrationTime: number | null;
  loading: boolean;
  error: string;
  propertyLoading?: boolean;
};

export default function TerrainSection({
  elevation,
  length,
  concentrationTime,
  loading,
  error,
  propertyLoading,
}: Props) {
  return (
    <section>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Høyde
          </label>
          <input
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            value={loading ? "Henter..." : elevation !== null ? `${elevation.toFixed(1)} m` : ""}
            readOnly
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Lengde
          </label>
          <input
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            value={loading ? "Henter..." : length !== null ? `${length.toFixed(1)} m` : ""}
            readOnly
          />
        </div>
      </div>

      {error && (
        <div className="mt-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Dobbeltklikk to punkter i kartet for å beregne lengde og høydeforskjell.
      </div>

      {concentrationTime !== null && !loading && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white/60 p-3 text-sm font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100">
          Konsentrasjonstid: <span className="font-semibold">{concentrationTime.toFixed(2)} min</span>
        </div>
      )}

      {propertyLoading && (
        <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          Henter eiendomsdata...
        </div>
      )}
    </section>
  );
}
