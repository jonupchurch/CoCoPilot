/** The two overlapping dots, blue over teal. The only brand element in the product. */
export function Mark({ size, dimmed = false }: { size: number; dimmed?: boolean }): React.JSX.Element {
  const dot = (background: string, overlap: boolean): React.CSSProperties => ({
    width: size,
    height: size,
    borderRadius: 'var(--radius-pill)',
    background,
    marginLeft: overlap ? -(size / 3) : 0,
  });

  return (
    <span
      aria-hidden="true"
      style={{ display: 'flex', alignItems: 'center', flex: 'none', opacity: dimmed ? 0.5 : 1 }}
    >
      <span style={dot('var(--blue)', false)} />
      <span style={dot('var(--teal)', true)} />
    </span>
  );
}
