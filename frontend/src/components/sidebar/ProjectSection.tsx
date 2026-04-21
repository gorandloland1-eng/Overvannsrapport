type Props = {
  projectName: string;
  setField: (field: string, value: string) => void;
};

export default function ProjectSection({ projectName, setField }: Props) {
  return (
    <section>
      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
        Project name
      </label>
      <input
        value={projectName}
        onChange={(e) => setField("projectName", e.target.value)}
        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
      />
    </section>
  );
}