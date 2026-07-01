export function formatRelativeSafe(iso: string | number | Date | undefined | null): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "unknown";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function safeRepoName(repo: string | undefined | null): string {
  if (!repo) return "unknown";
  const parts = repo.split("/");
  return parts.length >= 2 ? parts[1] : repo;
}
