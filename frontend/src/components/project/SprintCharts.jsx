import { useEffect, useMemo, useRef, useState } from "react";
import { formatDate } from "../../lib/format";
import { computeBurndown } from "../../lib/burndown";

/*
 * Sprint charts, hand-drawn in SVG (two small charts don't justify a chart library).
 * Mark specs follow the dataviz rules: 2px lines, columns <= 24px with a 4px
 * rounded cap, 1px solid gridlines, labels in text colours, a hover/focus
 * tooltip on every chart, and a data table so no value depends on hovering.
 * Colours: --chart-1 (data) and --chart-reference (the ideal line), both
 * validated for light and dark surfaces.
 */

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Clean axis: 0 to a round top with ~4 integer steps. */
function axis(max) {
  const raw = Math.max(max, 1) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const step = Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return { top, ticks };
}

const roundedTop = (x, y, w, h, r) => {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
};

function LineKey({ color }) {
  return (
    <svg width="16" height="8" aria-hidden="true" className="shrink-0">
      <line x1="1" x2="15" y1="4" y2="4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Tooltip({ x, y, children }) {
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs shadow-overlay"
      style={{ left: x, top: y - 8 }}
    >
      {children}
    </div>
  );
}

function ChartFigure({ title, subtitle, legend, table, children }) {
  return (
    <figure className="rounded-lg border border-line bg-surface p-4">
      <figcaption>
        <span className="block text-[13px] font-semibold text-text">{title}</span>
        {subtitle && <span className="mt-0.5 block text-xs text-subtle">{subtitle}</span>}
      </figcaption>
      {legend && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-subtle">{legend}</div>}
      <div className="mt-2">{children}</div>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer rounded text-subtle hover:text-text">Show data table</summary>
        <div className="mt-2 overflow-x-auto">{table}</div>
      </details>
    </figure>
  );
}

const tableClass = "w-full text-left text-xs tabular-nums [&_td]:py-1 [&_td]:pr-4 [&_th]:pb-1 [&_th]:pr-4 [&_th]:font-medium [&_th]:text-subtle";

// ─── Burndown ───────────────────────────────────────────────────────────────

export function BurndownChart({ sprint, tasks }) {
  const [ref, width] = useWidth();
  const { days, total, ideal, actual } = useMemo(() => computeBurndown(sprint, tasks), [sprint, tasks]);
  const [active, setActive] = useState(null);

  const lastActual = actual.reduce((last, v, i) => (v === null ? last : i), -1);
  const remainingNow = lastActual >= 0 ? actual[lastActual] : total;

  if (total === 0) {
    return (
      <ChartFigure title={`Burndown, ${sprint.name}`} subtitle="Add story points to this sprint's tasks to see how fast the work burns down." table={null}>
        <p className="py-6 text-center text-xs text-subtlest">No story points in this sprint yet.</p>
      </ChartFigure>
    );
  }

  const H = 190;
  const m = { t: 14, r: 64, b: 24, l: 30 };
  const iw = Math.max(0, width - m.l - m.r);
  const ih = H - m.t - m.b;
  const { top, ticks } = axis(total);
  const n = days.length;
  const x = (i) => m.l + (n > 1 ? (i * iw) / (n - 1) : iw / 2);
  const y = (v) => m.t + ih - (v / top) * ih;
  const path = (values) =>
    values
      .map((v, i) => (v === null ? null : `${x(i)},${y(v)}`))
      .filter(Boolean)
      .map((p, i) => `${i ? "L" : "M"}${p}`)
      .join(" ");
  const actualPoints = actual.map((v, i) => (v === null ? null : [x(i), y(v)])).filter(Boolean);
  const area =
    actualPoints.length > 1
      ? `M${actualPoints[0][0]},${y(0)} ${actualPoints.map(([px, py]) => `L${px},${py}`).join(" ")} L${actualPoints.at(-1)[0]},${y(0)} Z`
      : null;
  const xTicks = [...new Set([0, Math.floor((n - 1) / 2), n - 1])];

  const indexAt = (clientX, rect) => {
    if (n <= 1) return 0;
    const i = Math.round(((clientX - rect.left - m.l) / iw) * (n - 1));
    return Math.max(0, Math.min(n - 1, i));
  };

  const legend = (
    <>
      <span className="inline-flex items-center gap-1.5">
        <LineKey color="var(--chart-1)" /> Remaining
      </span>
      <span className="inline-flex items-center gap-1.5">
        <LineKey color="var(--chart-reference)" /> Ideal
      </span>
    </>
  );

  const table = (
    <table className={tableClass}>
      <thead>
        <tr>
          <th scope="col">Day</th>
          <th scope="col">Remaining</th>
          <th scope="col">Ideal</th>
        </tr>
      </thead>
      <tbody>
        {days.map((d, i) => (
          <tr key={d.getTime()}>
            <td>{formatDate(d)}</td>
            <td>{actual[i] ?? "—"}</td>
            <td>{ideal[i]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <ChartFigure
      title={`Burndown, ${sprint.name}`}
      subtitle={`${remainingNow} of ${total} points left, ${formatDate(days[0])} to ${formatDate(days.at(-1), true)}`}
      legend={legend}
      table={table}
    >
      <div ref={ref} className="relative">
        {width > 0 && (
          <svg
            width={width}
            height={H}
            tabIndex={0}
            role="img"
            aria-label={`Burndown: ${remainingNow} of ${total} story points left. Use the left and right arrow keys to read each day.`}
            className="block rounded focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
            onPointerMove={(e) => setActive(indexAt(e.clientX, e.currentTarget.getBoundingClientRect()))}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(Math.max(lastActual, 0))}
            onBlur={() => setActive(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") setActive((a) => Math.min(n - 1, (a ?? -1) + 1));
              else if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? 1) - 1));
              else return;
              e.preventDefault();
            }}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={m.l} x2={m.l + iw} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
                <text x={m.l - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-subtlest text-[10px] tabular-nums">
                  {t}
                </text>
              </g>
            ))}
            {xTicks.map((i) => (
              <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="fill-subtlest text-[10px]">
                {formatDate(days[i])}
              </text>
            ))}

            <path d={path(ideal)} fill="none" stroke="var(--chart-reference)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {area && <path d={area} fill="var(--chart-1)" opacity="0.1" />}
            {actualPoints.length > 1 && (
              <path d={path(actual)} fill="none" stroke="var(--chart-1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            )}

            {active !== null && <line x1={x(active)} x2={x(active)} y1={m.t} y2={m.t + ih} stroke="var(--border-strong)" strokeWidth="1" />}

            {lastActual >= 0 && (
              <>
                <circle cx={x(lastActual)} cy={y(actual[lastActual])} r="4" fill="var(--chart-1)" stroke="var(--surface)" strokeWidth="2" />
                {/* Above the dot: the ideal line always runs down and to the right from here. */}
                <text x={x(lastActual) + 6} y={y(actual[lastActual]) - 9} className="fill-subtle text-[11px] font-medium tabular-nums">
                  {actual[lastActual]} left
                </text>
              </>
            )}
          </svg>
        )}
        {active !== null && width > 0 && (
          <Tooltip x={x(active)} y={m.t}>
            <span className="block text-subtlest">{formatDate(days[active], true)}</span>
            {actual[active] !== null && (
              <span className="flex items-center gap-1.5">
                <LineKey color="var(--chart-1)" />
                <strong className="font-semibold text-text tabular-nums">{actual[active]}</strong>
                <span className="text-subtle">remaining</span>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <LineKey color="var(--chart-reference)" />
              <strong className="font-semibold text-text tabular-nums">{ideal[active]}</strong>
              <span className="text-subtle">ideal</span>
            </span>
          </Tooltip>
        )}
      </div>
    </ChartFigure>
  );
}

// ─── Velocity ───────────────────────────────────────────────────────────────

/** Completed story points per finished sprint, with the average as a reference line. */
export function VelocityChart({ data, average }) {
  const [ref, width] = useWidth();
  const [active, setActive] = useState(null);

  const H = 190;
  const m = { t: 18, r: 8, b: 24, l: 30 };
  const iw = Math.max(0, width - m.l - m.r);
  const ih = H - m.t - m.b;
  const { top, ticks } = axis(Math.max(average, ...data.map((d) => d.velocity)));
  const band = data.length ? iw / data.length : 0;
  const bw = Math.min(24, band * 0.6);
  const y = (v) => m.t + ih - (v / top) * ih;
  const maxLabelChars = Math.max(3, Math.floor(band / 6.5));
  const short = (s) => (s.length > maxLabelChars ? `${s.slice(0, maxLabelChars - 1)}…` : s);

  const table = (
    <table className={tableClass}>
      <thead>
        <tr>
          <th scope="col">Sprint</th>
          <th scope="col">Completed</th>
          <th scope="col">Committed</th>
        </tr>
      </thead>
      <tbody>
        {data.map((d) => (
          <tr key={d.sprintName + d.completedAt}>
            <td>{d.sprintName}</td>
            <td>{d.velocity}</td>
            <td>{d.committed ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <ChartFigure
      title="Velocity"
      subtitle={`Story points completed per sprint. Average ${average}.`}
      table={table}
    >
      <div ref={ref} className="relative">
        {width > 0 && (
          <svg width={width} height={H} role="group" aria-label={`Velocity of the last ${data.length} completed sprints, average ${average} points`} className="block">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={m.l} x2={m.l + iw} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
                <text x={m.l - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-subtlest text-[10px] tabular-nums">
                  {t}
                </text>
              </g>
            ))}

            {data.map((d, i) => {
              const cx = m.l + band * i + band / 2;
              const yv = y(d.velocity);
              const h = m.t + ih - yv;
              const dim = active !== null && active !== i;
              return (
                <g
                  key={d.sprintName + d.completedAt}
                  tabIndex={0}
                  role="img"
                  aria-label={`${d.sprintName}: ${d.velocity} points completed${d.committed != null ? ` of ${d.committed} committed` : ""}`}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="outline-none"
                >
                  <rect x={m.l + band * i} y={m.t} width={band} height={ih} fill="transparent" />
                  {h > 0 && <path d={roundedTop(cx - bw / 2, yv, bw, h, 4)} fill="var(--chart-1)" opacity={dim ? 0.45 : 1} />}
                  {active === i && (
                    <rect x={cx - bw / 2 - 3} y={yv - 3} width={bw + 6} height={h + 3} rx="5" fill="none" stroke="var(--focus-ring)" strokeWidth="2" />
                  )}
                  <text x={cx} y={yv - 6} textAnchor="middle" className="fill-subtle text-[11px] font-medium tabular-nums">
                    {d.velocity}
                  </text>
                  <text x={cx} y={H - 6} textAnchor="middle" className="fill-subtlest text-[10px]">
                    {short(d.sprintName)}
                  </text>
                </g>
              );
            })}

            <line x1={m.l} x2={m.l + iw} y1={y(average)} y2={y(average)} stroke="var(--chart-reference)" strokeWidth="1.5" />
            <text x={m.l + iw} y={y(average) - 4} textAnchor="end" className="fill-subtlest text-[10px]">
              Average {average}
            </text>
          </svg>
        )}
        {active !== null && width > 0 && data[active] && (
          <Tooltip x={m.l + band * active + band / 2} y={y(data[active].velocity)}>
            <strong className="block font-semibold text-text tabular-nums">{data[active].velocity} points</strong>
            <span className="block text-subtle">
              {data[active].sprintName}
              {data[active].committed != null && `, ${data[active].committed} committed`}
            </span>
          </Tooltip>
        )}
      </div>
    </ChartFigure>
  );
}
