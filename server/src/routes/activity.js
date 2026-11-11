import { Router } from 'express';
import { query } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/activity?limit=50&before=<id>&entity_type=supervisor
router.get('/', requireAdmin, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const params = [];
  const where = [];
  if (req.query.before && /^\d+$/.test(req.query.before)) {
    params.push(req.query.before);
    where.push(`id < $${params.length}`);
  }
  if (req.query.entity_type) {
    params.push(String(req.query.entity_type));
    where.push(`entity_type = $${params.length}`);
  }
  params.push(limit + 1);
  const { rows } = await query(
    `select * from activity_log ${where.length ? `where ${where.join(' and ')}` : ''}
     order by id desc limit $${params.length}`,
    params
  );
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  res.json({ items, next: hasMore ? items[items.length - 1].id : null });
});

export default router;
