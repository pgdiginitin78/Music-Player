// Deprecated: Express stream proxy removed for YouTube playback.
import express from 'express';
const router = express.Router();
router.get('/:id', (req, res) => res.status(410).json({ error: 'GONE', message: 'Audio proxy endpoint is removed. Playback uses YouTube IFrame Player API.' }));
export default router;
