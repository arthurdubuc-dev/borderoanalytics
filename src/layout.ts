/** Layout depends on the measured content width, including split view and landscape. */
export function kpiColumns(width: number, fontScale = 1, items = 4): number {
  const minimum = fontScale > 1.35 ? 245 : 148;
  return Math.max(
    1,
    Math.min(items, 4, Math.floor((width + 12) / (minimum + 12))),
  );
}
export function sectionPalette(key: string, dark = false) {
  const palette = (
    {
      vat: ["#F5F3FF", "#C4B5FD", "#6D28D9", "#A78BFA", "rgba(46,16,101,0.30)"],
      taxes: [
        "#F5F3FF",
        "#C4B5FD",
        "#6D28D9",
        "#A78BFA",
        "rgba(46,16,101,0.30)",
      ],
      A: ["#EFF6FF", "#93C5FD", "#1D4ED8", "#60A5FA", "rgba(23,37,84,0.30)"],
      B: ["#F0FDFA", "#5EEAD4", "#0F766E", "#2DD4BF", "rgba(4,47,46,0.30)"],
      C: ["#ECFDF5", "#6EE7B7", "#047857", "#34D399", "rgba(2,44,34,0.30)"],
      D: ["#FFF7ED", "#FDBA74", "#C2410C", "#FB923C", "rgba(67,20,7,0.30)"],
      P: ["#FDF2F8", "#F9A8D4", "#BE185D", "#F472B6", "rgba(80,7,36,0.30)"],
      E: ["#F1F3F5", "#C9CED6", "#4B5563", "#98A0AC", "#222832"],
    } as const
  )[key as "A"] ?? ["#F1F3F5", "#C9CED6", "#4B5563", "#98A0AC", "#222832"];
  return {
    background: dark ? palette[4] : palette[0],
    border: dark ? palette[3] : palette[1],
    text: dark ? palette[3] : palette[2],
  };
}
