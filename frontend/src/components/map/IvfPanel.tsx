import type { IvfResponse, WeatherStation } from "../../api/ivf";

interface IvfPanelProps {
  ivfData: IvfResponse | null;
  ivfLoading: boolean;
  ivfError: string;
  selectedStation: WeatherStation | undefined;
}

export default function IvfPanel({ ivfData, ivfLoading, ivfError, selectedStation }: IvfPanelProps) {
  return (
    <div className="h-full overflow-auto bg-white p-4 pt-20 dark:bg-slate-950">
      <div className="mb-4">
        <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">IVF-tabell</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {ivfData?.station_name || selectedStation?.name || "Ingen værstasjon valgt"}
        </div>
        {ivfData?.first_year && ivfData?.last_year && (
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Data fra {ivfData.first_year} til {ivfData.last_year}
          </div>
        )}
      </div>
      {ivfLoading && <div className="text-sm text-slate-500 dark:text-slate-400">Laster IVF-data...</div>}
      {ivfError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {ivfError}
        </div>
      )}
      {!ivfLoading && !ivfError && ivfData && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="bg-blue-100 dark:bg-slate-800">
                <th className="border-r border-b border-slate-400 px-3 py-2"></th>
                <th colSpan={ivfData.durations.length} className="border-b border-slate-400 px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                  Varigheter (minutter)
                </th>
              </tr>
              <tr className="bg-blue-100 dark:bg-slate-800">
                <th className="border-r border-b border-slate-400 px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                  Returperiode (år)
                </th>
                {ivfData.durations.map((d) => (
                  <th key={d} className="border-r border-b border-slate-400 px-2 py-2 text-center font-semibold text-slate-700 last:border-r-0 dark:text-slate-200">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ivfData.return_periods.map((period, i) => (
                <tr key={period} className={i % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50 dark:bg-slate-900"}>
                  <td className="border-r border-b border-slate-300 px-3 py-2 font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
                    {period}
                  </td>
                  {ivfData.durations.map((d) => (
                    <td key={`${period}-${d}`} className="border-r border-b border-slate-300 px-2 py-2 text-center text-slate-700 last:border-r-0 dark:border-slate-700 dark:text-slate-200">
                      {ivfData.ls_ha[String(d)]?.[String(period)] ?? "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!ivfLoading && !ivfError && !ivfData && (
        <div className="text-sm text-slate-500 dark:text-slate-400">Ingen IVF-data tilgjengelig.</div>
      )}
    </div>
  );
}
