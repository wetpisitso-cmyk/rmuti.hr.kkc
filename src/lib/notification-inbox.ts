export type NotificationFilter = "unread" | "all";
export type NoticeMetadata = { read_at: string | null; created_at: string };

/** Never mutate cached server data when prioritizing unread notices. */
export function visibleNotifications<T extends NoticeMetadata>(
  notices: readonly T[], filter: NotificationFilter,
): T[] {
  return notices
    .filter(n => filter === "all" || !n.read_at)
    .sort((a,b) => Number(Boolean(a.read_at)) - Number(Boolean(b.read_at))
      || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
