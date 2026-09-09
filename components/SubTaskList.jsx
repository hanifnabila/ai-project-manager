'use client';

export default function SubTaskList({ item, onToggle, busyKey = '' }) {
  const tasks = Array.isArray(item.tasks) ? item.tasks : [];
  const completed = Array.isArray(item.completed_tasks) ? item.completed_tasks : [];
  const doneCount = tasks.filter((t) => completed.includes(t)).length;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  if (total === 0) return null;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Detail Tugas:
        </h4>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {doneCount}/{total}
        </span>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
          <div
            className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{pct}%</span>
      </div>

      <ul className="space-y-1">
        {tasks.map((task, idx) => {
          const done = completed.includes(task);
          const busy = busyKey === `${item.id}|${task}`;
          return (
            <li key={idx} className="flex items-start gap-2">
              <button
                type="button"
                role="checkbox"
                aria-checked={done}
                disabled={!!busy}
                onClick={() => onToggle(item, task, !done)}
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors disabled:opacity-50 ${
                  done
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-slate-300 bg-white text-transparent hover:border-amber-400 dark:border-slate-600 dark:bg-white/10'
                }`}
                title={done ? 'Tandai belum selesai' : 'Tandai selesai'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <span
                className={`min-w-0 flex-1 break-words text-sm ${
                  done ? 'text-slate-400 line-through dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                {done && <span className="mr-1 text-emerald-600 dark:text-emerald-400">✓</span>}
                {task}
              </span>
              {busy && (
                <svg className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}