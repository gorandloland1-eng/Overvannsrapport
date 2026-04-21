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
};

export default function StationSection({
  stations,
  selectedStationId,
  setSelectedStationId,
  search,
  setSearch,
  dropdownOpen,
  setDropdownOpen,
}: Props) {

  const selectedStation = stations.find(s => s.id === selectedStationId);

  const filteredStations = stations.filter((s) =>
    `${s.name} ${s.municipality ?? ""} ${s.county ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <section>
      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
        Weather station
      </label>

      <div className="relative">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setDropdownOpen(true);
          }}
          onFocus={() => setDropdownOpen(true)}
          placeholder={
            selectedStation
              ? `${selectedStation.name}${selectedStation.municipality ? ` (${selectedStation.municipality})` : ""}`
              : "Search..."
          }
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none dark:bg-slate-900 dark:text-slate-100"
        />

        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="absolute right-3 top-1/2 -translate-y-1/2"
        >
          ▾
        </button>

        {dropdownOpen && (
          <div className="absolute z-20 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border bg-white dark:bg-slate-900">
            {filteredStations.length > 0 ? (
              filteredStations.map((station) => (
                <button
                  key={station.id}
                  onClick={() => {
                    setSelectedStationId(station.id);
                    setSearch("");
                    setDropdownOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {station.name}
                  {station.municipality && ` (${station.municipality})`}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-slate-500">
                No stations found
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}