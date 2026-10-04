/**
 * Summary figures as one divided strip rather than four floating cards.
 * Only values the API actually returns; no invented trends.
 */

export default function MetricStrip({ metrics }) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-surface lg:grid-cols-4">
      {metrics.map((m, i) => (
        <div
          key={m.label}
          className={[
            "px-4 py-3",
            i % 2 === 1 ? "border-l border-line" : "",
            i >= 2 ? "border-t border-line lg:border-t-0" : "",
            i === 2 ? "lg:border-l" : "",
          ].join(" ")}
        >
          <dt className="text-xs text-subtle">{m.label}</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums tracking-[-0.01em] text-text">{m.value}</dd>
          {m.sub && <dd className="mt-0.5 truncate text-xs text-subtlest">{m.sub}</dd>}
        </div>
      ))}
    </dl>
  );
}
