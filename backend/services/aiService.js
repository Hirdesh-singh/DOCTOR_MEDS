import { GoogleGenerativeAI } from '@google/generative-ai';

// Lazy-initialize so app doesn't crash if key is missing
let genAI = null;
const getGenAI = () => {
  if (!genAI && process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
};

const FALLBACK_PRE_VISIT = {
  urgencyLevel: 'Unavailable',
  chiefComplaint: 'AI summary unavailable — please review original patient symptoms.',
  suggestedQuestions: [],
  status: 'FAILED',
};

const FALLBACK_POST_VISIT = {
  summary: 'AI post-visit summary unavailable. Please refer to the clinical notes.',
  medicationSchedule: [],
  followUpSteps: [],
  status: 'FAILED',
};

/**
 * Parse JSON from LLM response, handling markdown code fences.
 */
const parseJSON = (text) => {
  // Strip markdown code block if present
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
};

/**
 * Generate a pre-visit summary for a patient's symptoms.
 * NEVER throws — always returns a valid object.
 *
 * @param {Object} symptoms - { chiefSymptoms, duration, severity, additionalNotes }
 * @returns {Object} { urgencyLevel, chiefComplaint, suggestedQuestions, status }
 */
export const generatePreVisitSummary = async (symptoms) => {
  const ai = getGenAI();
  if (!ai) {
    console.warn('[AI] Gemini API key not configured. Returning fallback.');
    return FALLBACK_PRE_VISIT;
  }

  const symptomText = [
    symptoms.chiefSymptoms && `Chief symptoms: ${symptoms.chiefSymptoms}`,
    symptoms.duration && `Duration: ${symptoms.duration}`,
    symptoms.severity && `Severity: ${symptoms.severity}`,
    symptoms.additionalNotes && `Additional notes: ${symptoms.additionalNotes}`,
  ]
    .filter(Boolean)
    .join('\n');

  const prompt = `You are a clinical assistant helping prepare for a medical consultation.

Analyse these patient symptoms and return a structured pre-visit summary.

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "urgencyLevel": "Low" | "Medium" | "High",
  "chiefComplaint": "A concise 1-2 sentence clinical summary",
  "suggestedQuestions": ["question 1", "question 2", "question 3"]
}

Rules:
- urgencyLevel must be exactly one of: Low, Medium, High
- Provide exactly 3 suggested questions for the doctor
- Do NOT diagnose. Do NOT prescribe. Only assist preparation.
- chiefComplaint must be objective and professional

Patient Symptoms:
${symptomText}`;

  try {
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const parsed = parseJSON(text);

    // Validate required fields
    const validUrgency = ['Low', 'Medium', 'High'].includes(parsed.urgencyLevel);
    if (!validUrgency) parsed.urgencyLevel = 'Low';

    if (!Array.isArray(parsed.suggestedQuestions)) {
      parsed.suggestedQuestions = [];
    }

    return {
      urgencyLevel: parsed.urgencyLevel,
      chiefComplaint: parsed.chiefComplaint || '',
      suggestedQuestions: parsed.suggestedQuestions.slice(0, 3),
      status: 'SUCCESS',
    };
  } catch (error) {
    console.error('[AI] Pre-visit summary failed:', error.message);
    return FALLBACK_PRE_VISIT;
  }
};

/**
 * Generate a patient-friendly post-visit summary.
 * NEVER throws — always returns a valid object.
 *
 * @param {string} clinicalNotes - Doctor's clinical notes
 * @param {Array}  medicines     - Array of { name, dosage, frequency, durationDays }
 * @returns {Object} { summary, medicationSchedule, followUpSteps, status }
 */
export const generatePostVisitSummary = async (clinicalNotes, medicines = []) => {
  const ai = getGenAI();
  if (!ai) {
    console.warn('[AI] Gemini API key not configured. Returning fallback.');
    return FALLBACK_POST_VISIT;
  }

  const prescriptionText =
    medicines.length > 0
      ? medicines
          .map(
            (m) =>
              `- ${m.name}: ${m.dosage}, ${m.frequency}, for ${m.durationDays} days${m.instructions ? ' (' + m.instructions + ')' : ''}`
          )
          .join('\n')
      : 'No medications prescribed.';

  const prompt = `You are a healthcare assistant creating a patient-friendly visit summary.

Convert the clinical notes below into a clear, jargon-free summary that a patient can understand.

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "summary": "A simple 2-3 sentence explanation of the visit and findings",
  "medicationSchedule": [
    {
      "medicine": "Medicine name",
      "dosage": "Dosage",
      "frequency": "When to take it in plain language",
      "duration": "How long to take it",
      "instructions": "Any special instructions"
    }
  ],
  "followUpSteps": ["step 1", "step 2"]
}

Rules:
- Use simple language a non-medical patient can understand
- Do NOT make new diagnoses or recommendations beyond the notes
- Include a follow-up reminder if mentioned in the notes
- If no medication, return empty medicationSchedule array

Clinical Notes:
${clinicalNotes}

Prescription:
${prescriptionText}`;

  try {
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const parsed = parseJSON(text);

    return {
      summary: parsed.summary || '',
      medicationSchedule: Array.isArray(parsed.medicationSchedule) ? parsed.medicationSchedule : [],
      followUpSteps: Array.isArray(parsed.followUpSteps) ? parsed.followUpSteps : [],
      status: 'SUCCESS',
    };
  } catch (error) {
    console.error('[AI] Post-visit summary failed:', error.message);
    return FALLBACK_POST_VISIT;
  }
};
