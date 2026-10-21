/** The Precifarm mark: four solar cells (clipped-corner wafers), shared with the Command Centre. */
export default function BrandMark({ size = 18 }: { size?: number }) {
  // A 6.5 unit square with 1.4 unit clipped corners, like a monocrystalline wafer.
  const cell = (x: number, y: number) => `M${x + 1.4} ${y}h3.7l1.4 1.4v3.7l-1.4 1.4h-3.7l-1.4-1.4v-3.7z`;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d={cell(1, 1)} fill="#fff" />
      <path d={cell(8.5, 1)} fill="#fff" opacity=".78" />
      <path d={cell(1, 8.5)} fill="#fff" opacity=".78" />
      <path d={cell(8.5, 8.5)} fill="#fff" />
    </svg>
  );
}
