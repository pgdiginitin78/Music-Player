import express from 'express';
import { debugAudioSource } from '../controllers/debugController.js';

const router = express.Router();

router.get('/audio-source', debugAudioSource);

export default router;
