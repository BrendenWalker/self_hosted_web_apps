/** @param {import('recharts/types/component/DefaultTooltipContent').TooltipProps<number, string> | undefined} e */
export function chartClickToYear(e) {
  if (e?.activeLabel == null) return null;
  const y = Number(e.activeLabel);
  return Number.isFinite(y) ? y : null;
}
