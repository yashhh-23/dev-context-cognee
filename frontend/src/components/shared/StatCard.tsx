export default function StatCard({
  label, value, sub, color
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="stat-card">
      <p className="stat-label">{label}</p>
      <p className="stat-value" style={color ? { color } : {}}>{value}</p>
      {sub && <p className="stat-sub">{sub}</p>}
    </div>
  );
}
