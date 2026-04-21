type Props = {
  municipalityNumber: string;
  cadastralNumber: string;
  propertyNumber: string;
  setMunicipalityNumber: (v: string) => void;
  setCadastralNumber: (v: string) => void;
  setPropertyNumber: (v: string) => void;
  onLookup: () => void;
  loading: boolean;
  address: string | null;
  matrikkel: {
    gnr: number;
    bnr: number;
    kommunenummer: string;
  } | null;
  error: string;
  propertyLoading: boolean;
};

export default function PropertySection({
  municipalityNumber,
  cadastralNumber,
  propertyNumber,
  setMunicipalityNumber,
  setCadastralNumber,
  setPropertyNumber,
  onLookup,
  loading,
  address,
  matrikkel,
  error,
  propertyLoading,
}: Props) {
  return (
    <section>
      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
        Property ID
      </label>

      <div className="grid grid-cols-3 gap-2">
        <input
          value={municipalityNumber}
          onChange={(e) => setMunicipalityNumber(e.target.value)}
          placeholder="Knr"
          maxLength={4}
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
        />
        <input
          value={cadastralNumber}
          onChange={(e) => setCadastralNumber(e.target.value)}
          placeholder="Gnr"
          type="number"
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
        />
        <input
          value={propertyNumber}
          onChange={(e) => setPropertyNumber(e.target.value)}
          placeholder="Bnr"
          type="number"
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
        />
      </div>

      <button
        type="button"
        onClick={onLookup}
        disabled={loading || !municipalityNumber || !cadastralNumber || !propertyNumber}
        className="mt-2 h-9 w-full rounded-xl bg-[#213F53] text-sm font-medium text-white transition hover:bg-[#1a3244] disabled:opacity-50"
      >
        {loading ? "Looking up..." : "Look up property"}
      </button>

      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Or click the map to auto-fill
      </p>

      {(address || matrikkel) && !propertyLoading && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white/60 p-3 dark:border-slate-700 dark:bg-slate-800/60">
          <div className="mb-1 text-xs text-slate-500 dark:text-slate-400">
            Nearest address
          </div>
          <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {address ?? "No address found"}
          </div>
          {matrikkel && (
            <div className="mt-2 flex gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span>Knr: <span className="font-semibold text-slate-700 dark:text-slate-200">{matrikkel.kommunenummer}</span></span>
              <span>Gnr: <span className="font-semibold text-slate-700 dark:text-slate-200">{matrikkel.gnr}</span></span>
              <span>Bnr: <span className="font-semibold text-slate-700 dark:text-slate-200">{matrikkel.bnr}</span></span>
            </div>
          )}
        </div>
      )}

      {propertyLoading && (
        <p className="mt-2 text-xs text-slate-400">
          Fetching property data...
        </p>
      )}

      {error && !propertyLoading && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          {error}
        </p>
      )}
    </section>
  );
}