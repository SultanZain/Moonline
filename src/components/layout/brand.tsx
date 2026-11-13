/**
 * Identify Moonline with a lunar limb and a local horizon mark.
 * @author Sultan
 */
export function Brand() {
  return (
    <span className="inline-flex items-center gap-3 text-base font-semibold tracking-wide" title="Moonline" aria-label="Moonline">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true" className="text-accent">
        <path d="M4 17a10 10 0 1 1 20 0M2 17h24M8 22h12" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <span className="brand-label">MOONLINE</span>
    </span>
  );
}
