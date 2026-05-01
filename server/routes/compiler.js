import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { compileCode } from '../controllers/compilerController.js';

const router = express.Router();

router.post('/compile', compileCode);

export default router;

