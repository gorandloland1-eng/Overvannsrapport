type Props = {
  elev1?: number | null;
  elev2?: number | null;
  heightDifference?: number | null;
  length?: number | null;
  concentrationTime?: number | null;
  loading: boolean;
  error: string;
  propertyLoading?: boolean;
  validationErrors?: {
    heightDifference?: string;
    concentrationTime?: string;
  };
};

function formatMeters(value?: number | null, decimals = 1) {
  if (value == null) return "";
  return `${value.toFixed(decimals)} m`;
}

function formatMinutes(value?: number | null) {
  if (value == null) return "";
  return `${value.toFixed(2)} min`;
}

function hasAnyResult(
  heightDifference?: number | null,
  length?: number | null,
  concentrationTime?: number | null
) {
  return heightDifference != null || length != null || concentrationTime != null;
}

export default function TerrainSection({
  elev1,
  elev2,
  heightDifference,
  length,
  concentrationTime,
  loading,
  error,
  propertyLoading,
  validationErrors = {},
}: Props) {
  const missingTerrain =
    (validationErrors.heightDifference && heightDifference === null) ||
    (validationErrors.concentrationTime && concentrationTime === null);

  return (
    <section>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Høyde punkt 1
          </label>
          <input
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            value={loading ? "Henter..." : formatMeters(elev1, 2)}
            readOnly
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Høyde punkt 2
          </label>
          <input
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            value={loading ? "Henter..." : formatMeters(elev2, 2)}
            readOnly
          />
        </div>
      </div>

      {error && (
        <div className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</div>
      )}

      {missingTerrain && !error && (
        <p className="mt-1 text-xs text-red-500 dark:text-red-400">
          {validationErrors.heightDifference ?? validationErrors.concentrationTime}
        </p>
      )}

      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Dobbeltklikk to punkter i kartet for å beregne høyder, lengde og konsentrasjonstid.
      </div>

      {hasAnyResult(heightDifference, length, concentrationTime) && !loading && (
        <div className={`mt-3 rounded-xl border p-3 text-sm dark:text-slate-100 ${
          missingTerrain
            ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/10"
            : "border-slate-200 bg-white/60 dark:border-slate-700 dark:bg-slate-800/60"
        }`}>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500 dark:text-slate-400">Høydeforskjell</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{formatMeters(heightDifference, 2)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500 dark:text-slate-400">Lengdeforskjell</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{formatMeters(length)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500 dark:text-slate-400">Konsentrasjonstid</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{formatMinutes(concentrationTime)}</span>
            </div>
          </div>
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
