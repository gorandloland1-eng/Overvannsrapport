type Props = {
  projectName: string;
  setField: (field: string, value: string) => void;
  error?: string;
};

export default function ProjectSection({ projectName, setField, error }: Props) {
  return (
    <section>
      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
        Prosjekt navn
      </label>
      <input
        value={projectName}
        onChange={(e) => setField("projectName", e.target.value)}
        className={`h-10 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:ring-4 dark:bg-slate-900 dark:text-slate-100 ${
          error
            ? "border-red-400 focus:border-red-400 focus:ring-red-100 dark:border-red-500 dark:focus:ring-red-900/30"
            : "border-slate-200 focus:border-slate-300 focus:ring-slate-200 dark:border-slate-700 dark:focus:ring-slate-700"
        }`}
      />
      {error && (
        <p className="mt-1 text-xs text-red-500 dark:text-red-400">{error}</p>
      )}
    </section>
  );
}