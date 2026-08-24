import express from 'express';
import { generatePreVisitSummary, generatePostVisitSummary } from '../services/aiService.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/ai/pre-visit-summary
 * Generates a pre-visit summary from patient symptoms.
 * Body: { chiefSymptoms, duration, severity, additionalNotes }
 */
router.post('/pre-visit-summary', authenticate, async (req, res) => {
  const { chiefSymptoms, duration, severity, additionalNotes } = req.body;

  if (!chiefSymptoms) {
    return res.status(400).json({ success: false, message: 'chiefSymptoms is required.' });
  }

  const symptoms = { chiefSymptoms, duration, severity, additionalNotes };
  const result = await generatePreVisitSummary(symptoms);

  return res.json({ success: true, ...result });
});

/**
 * POST /api/ai/post-visit-summary
 * Generates a patient-friendly post-visit summary from clinical notes.
 * Body: { clinicalNotes, medicines: [{name, dosage, frequency, durationDays}] }
 */
router.post('/post-visit-summary', authenticate, async (req, res) => {
  const { clinicalNotes, medicines = [] } = req.body;

  if (!clinicalNotes) {
    return res.status(400).json({ success: false, message: 'clinicalNotes is required.' });
  }

  const result = await generatePostVisitSummary(clinicalNotes, medicines);

  return res.json({ success: true, ...result });
});

export default router;
