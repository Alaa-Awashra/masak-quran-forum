/**
 * تسجيل نشاط في سجل النشاط.
 * db: pool أو client داخل transaction (أي كائن فيه query)
 */
export async function logActivity(db, actor, action, entityType, entityId, entityName, details = {}) {
  await db.query(
    `insert into activity_log (actor_id, actor_name, action, entity_type, entity_id, entity_name, details)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [actor?.id ?? null, actor?.full_name ?? null, action, entityType, entityId ?? null, entityName ?? null, JSON.stringify(details)]
  );
}
