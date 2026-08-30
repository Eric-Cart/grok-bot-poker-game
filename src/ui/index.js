import { renderApp } from "./render.js";
import "./styles.css";

/**
 * UI module. Renders public table state and emits actions.
 * Does not import betting rules or the evaluator.
 */
export function mount(root, view) {
  renderApp(root, view);

  const onAction = view.onAction;
  root.querySelectorAll("[data-act]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.getAttribute("data-act");
      if (type === "nexthand") {
        view.onNextHand?.();
        return;
      }
      if (type === "raise") {
        const input = root.querySelector("#raise-input");
        onAction?.({ type: "raise", amount: Number(input.value) });
        return;
      }
      onAction?.({ type });
    });
  });

  const range = root.querySelector("#raise-range");
  const input = root.querySelector("#raise-input");
  const sync = (value) => view.onRaiseChange?.(Number(value));
  range?.addEventListener("input", () => sync(range.value));
  input?.addEventListener("change", () => sync(input.value));
}

export { renderApp } from "./render.js";
