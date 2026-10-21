import Link from "next/link";
import type { Station, Tone } from "@/lib/flow";

/**
 * A workflow drawn as stations joined by arrows. Each station shows its count and one dot per record;
 * a dot travels along an arrow while records sit upstream of it. Scrolls sideways on a phone.
 */
export default function FlowStrip({ stations, label, legend }: { stations: Station[]; label: string; legend?: Array<[Tone, string]> }) {
  return (
    <section className="flow" aria-label={label}>
      {legend && legend.length ? (
        <div className="flow-key" aria-label="Colour key">
          {legend.map(([t, l]) => (
            <span key={l}>
              <i className={"t-" + t} />
              {l}
            </span>
          ))}
        </div>
      ) : null}
      <ol className="flow-row">
        {stations.map((s, i) => {
          const body = (
            <>
              <span className="flow-label">{s.label}</span>
              <span className="flow-mid">
                <b className="flow-val">{s.value}</b>
                {s.sub ? <span className="flow-sub">{s.sub}</span> : null}
              </span>
              <span className="flow-dots" aria-hidden="true">
                {s.dots.slice(0, 48).map((t, j) => (
                  <i key={j} className={"t-" + t} />
                ))}
                {s.dots.length > 48 ? <em>+{s.dots.length - 48}</em> : null}
              </span>
            </>
          );
          const moving = s.dots.some((t) => t !== "warn") && i < stations.length - 1;
          const empty = !s.dots.length && /^(0|KSh 0)$/.test(s.value);
          return (
            <li key={s.key} className="flow-cell" style={{ animationDelay: `${i * 60}ms` }}>
              {s.href ? (
                <Link href={s.href} className={`flow-st t-${s.tone}${s.active ? " is-active" : ""}${empty ? " is-empty" : ""}`} aria-current={s.active ? "true" : undefined} aria-label={`${s.label}: ${s.value}${s.sub ? ", " + s.sub : ""}`}>
                  {body}
                </Link>
              ) : (
                <div className={`flow-st t-${s.tone}${empty ? " is-empty" : ""}`}>{body}</div>
              )}
              {i < stations.length - 1 ? (
                <span className={`flow-arrow${moving ? " is-moving" : ""}`} aria-hidden="true">
                  <i />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
