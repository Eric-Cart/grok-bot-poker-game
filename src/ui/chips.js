const DENOMS = [
  { value: 1000, color: "chip-amber" },
  { value: 500, color: "chip-purple" },
  { value: 100, color: "chip-black" },
  { value: 25, color: "chip-green" },
  { value: 10, color: "chip-blue" },
  { value: 5, color: "chip-red" },
];

export function breakChips(amount) {
  let left = Math.max(0, Math.floor(amount));
  const stacks = [];
  for (const d of DENOMS) {
    const count = Math.floor(left / d.value);
    if (count > 0) {
      stacks.push({ value: d.value, color: d.color, count });
      left -= count * d.value;
    }
  }
  return stacks;
}

export function chipStackHtml(amount, { compact = false, label = "" } = {}) {
  const stacks = breakChips(amount);
  const shown = stacks.map((s) => ({ ...s, count: Math.min(s.count, compact ? 6 : 9) }));
  if (shown.length === 0) {
    return `<div class="chip-rack empty" aria-hidden="true"></div>`;
  }
  const piles = shown
    .map((s) => {
      const discs = Array.from({ length: s.count }, (_, i) => {
        const y = i * 3;
        return `<span class="chip ${s.color}" style="--n:${i}; bottom:${y}px"></span>`;
      }).join("");
      return `<div class="chip-pile" title="${s.count} × ${s.value}">${discs}</div>`;
    })
    .join("");
  return `
    <div class="chip-rack ${compact ? "compact" : ""}" aria-label="${label || `${amount} chips`}">
      ${piles}
    </div>
  `;
}
