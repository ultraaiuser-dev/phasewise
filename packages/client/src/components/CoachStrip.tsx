import {
  Card,
  canHandSatisfyPhase,
  getCardsContributingToPhase,
  getPhaseDefinition,
} from "@phasewise/shared";

export function getPhaseProgress(hand: Card[], phase: number) {
  const reqs = getPhaseDefinition(phase)!.requirements;
  if (canHandSatisfyPhase(hand, phase).satisfied)
    return reqs.map((r) => `${r.description} ✓`).join(" · ");
  let remaining = [...hand];
  return reqs
    .map((req) => {
      const wilds = remaining.filter((c) => c.type === "wild");
      const nums = remaining.filter((c) => c.type === "number");
      let group: Card[] = [];
      if (req.type === "run") {
        for (let start = 1; start <= 13 - req.count; start++) {
          const seen = new Set<number>();
          const candidate = nums.filter(
            (c) =>
              c.value! >= start &&
              c.value! < start + req.count &&
              !seen.has(c.value!) &&
              !!seen.add(c.value!),
          );
          if (candidate.length > group.length) group = candidate;
        }
      } else {
        for (const c of nums) {
          const candidate = nums.filter((n) =>
            req.type === "set" ? n.value === c.value : n.color === c.color,
          );
          if (candidate.length > group.length) group = candidate;
        }
      }
      const used = group.length
        ? [
            ...group.slice(0, req.count),
            ...wilds.slice(0, Math.max(0, req.count - group.length)),
          ]
        : [];
      const ids = new Set(used.map((c) => c.id));
      remaining = remaining.filter((c) => !ids.has(c.id));
      const count = Math.min(req.count, used.length);
      return `${req.description}: ${count === req.count ? "✓" : `need ${req.count - count} more`}`;
    })
    .join(" · ");
}
export function CoachStrip({ text }: { text: string }) {
  return (
    <aside className="coach-strip" data-testid="coach-strip">
      <span className="coach-icon" aria-hidden="true">
        ✧
      </span>
      <div>
        <strong>COACH</strong>
        <p>{text}</p>
      </div>
    </aside>
  );
}
export function usefulDiscard(hand: Card[], phase: number, laid: boolean) {
  const helpful = new Set(laid ? [] : getCardsContributingToPhase(hand, phase));
  return [...hand]
    .sort(
      (a, b) =>
        Number(helpful.has(a.id)) - Number(helpful.has(b.id)) ||
        (b.type === "skip" ? 15 : b.value || 0) -
          (a.type === "skip" ? 15 : a.value || 0),
    )
    .find((c) => c.type !== "wild")?.id;
}
