export async function publishDraft(db: D1Database, id: string): Promise<boolean> {
  // All statements execute in one D1 transaction; no active version is lost if target is stale.
  const result = await db.batch([
    db.prepare(`UPDATE schedule_weeks SET status = 'archived', updated_at = datetime('now')
      WHERE status = 'published' AND (group_code, week_start) IN
        (SELECT group_code, week_start FROM schedule_weeks WHERE id = ? AND status = 'draft')`).bind(id),
    db.prepare("UPDATE schedule_weeks SET status = 'published', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status = 'draft'").bind(id),
  ])
  return result[1].meta.changes > 0
}
