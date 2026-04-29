import { ChevronDown } from "lucide-react";
import { useEffect, useRef } from "react";

type Station = {
  id: string;
  name: string;
  municipality?: string;
  county?: string;
};

type Props = {
  stations: Station[];
  selectedStationId: string;
  setSelectedStationId: (id: string) => void;
  search: string;
  setSearch: (v: string) => void;
  dropdownOpen: boolean;
  setDropdownOpen: (v: boolean) => void;
  error?: string;
};

export default function StationSection({
  stations,
  selectedStationId,
  setSelectedStationId,
  search,
  setSearch,
  dropdownOpen,
  setDropdownOpen,
  error,
}: Props) {
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const selectedStation = stations.find((s) => s.id === selectedStationId);

  const filteredStations = stations.filter((s) =>
    `${s.name} ${s.municipality ?? ""} ${s.county ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const hasError = !!error && !selectedStationId;

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!dropdownOpen) return;

      const target = e.target as Node;
      if (!dropdownRef.current?.contains(target)) {
        setDropdownOpen(false);
      }
    }

    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [dropdownOpen, setDropdownOpen]);

  return (
    <section className="relative z-30">
      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
        Værstasjon
      </label>

      <div ref={dropdownRef} className="relative z-30">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setDropdownOpen(true); }}
          onFocus={() => setDropdownOpen(true)}
          placeholder={
            selectedStation
              ? `${selectedStation.name}${selectedStation.municipality ? ` (${selectedStation.municipality})` : ""}`
              : "Søk..."
          }
          className={`h-12 w-full rounded-[22px] border bg-white px-5 pr-12 text-base text-slate-900 outline-none focus:ring-4 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 ${
            hasError
              ? "border-red-400 focus:border-red-400 focus:ring-red-100 dark:border-red-500 dark:focus:ring-red-900/30"
              : "border-slate-200 focus:border-slate-300 focus:ring-slate-200 dark:border-slate-700 dark:focus:ring-slate-700"
          }`}
        />

        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-700 dark:text-slate-200"
          aria-label="Åpne nedtrekksliste for værstasjon"
        >
          <ChevronDown
            size={20}
            strokeWidth={2.2}
            className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
          />
        </button>

        {dropdownOpen && (
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[9999] max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            {filteredStations.length > 0 ? (
              filteredStations.map((station) => (
                <button
                  key={station.id}
                  type="button"
                  onClick={() => { setSelectedStationId(station.id); setSearch(""); setDropdownOpen(false); }}
                  className={`block w-full px-4 py-2.5 text-left text-sm transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800 ${
                    selectedStationId === station.id ? "bg-slate-100 dark:bg-slate-800" : ""
                  }`}
                >
                  {station.name}{station.municipality && ` (${station.municipality})`}
                </button>
              ))
            ) : (
              <div className="px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400">
                Ingen stasjoner funnet
              </div>
            )}
          </div>
        )}
      </div>

      {hasError && (
        <p className="mt-1 text-xs text-red-500 dark:text-red-400">{error}</p>
      )}
    </section>
  );
}
