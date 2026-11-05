const terms = {
  set: "Cards with the same number, such as three 7s. Colors can differ.",
  run: "Consecutive numbers from 1 to 12, such as 4–5–6–7. Colors can differ.",
  meld: "A valid group of cards laid on the table: a set, run, or color group.",
  hit: "Add a matching card to any meld after laying down your own phase.",
  wild: "A substitute for a missing number or color. Every meld still needs a natural number card.",
  skip: "Discard this card to make an opponent miss a turn. It cannot be picked up or melded.",
  phase:
    "Your goal for this round. Complete it and go out to advance to the next goal.",
};
export function Glossary() {
  return (
    <details className="glossary">
      <summary>Card table glossary</summary>
      <dl>
        {Object.entries(terms).map(([term, meaning]) => (
          <div key={term}>
            <dt tabIndex={0} title={meaning}>
              {term}
            </dt>
            <dd>{meaning}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
