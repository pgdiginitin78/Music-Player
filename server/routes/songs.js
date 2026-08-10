import express from 'express';
import { getSongs, getSongById, getSongPlayback, getProviderCapabilities } from '../controllers/songController.js';

const router = express.Router();

router.get('/', getSongs);
router.get('/search', getSongs);
router.get('/capabilities', getProviderCapabilities);
router.get('/:id/playback', getSongPlayback);
router.get('/:id', getSongById);

export default router;
