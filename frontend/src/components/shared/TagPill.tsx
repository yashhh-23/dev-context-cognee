export default function TagPill({ label, color }: { label: string; color?: string }) {
  return (
    <span className="tag-pill" style={color ? { background: color + '22', color } : {}}>
      {label}
    </span>
  );
}
