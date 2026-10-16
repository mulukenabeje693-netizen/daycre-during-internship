const OpenAI = require('openai');

// Lazy-initialised OpenAI client.
// The client is created ON DEMAND (inside validateId) and only when a valid
// OPENAI_API_KEY is present, so a missing/empty key does NOT crash the server
// at module load time. ID validation is optional when the key is unavailable.
let openaiClient = null;

const getOpenAI = () => {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
};

// ─── System prompts ───────────────────────────────────────────────────────────
const SYSTEM_PROMPT_FRONT = `You are an automated ID Card Validation Assistant. Your job is to inspect user-uploaded images and determine if they are valid identity card scans based on strict criteria.

For the Front Side Image:
- Check if the image contains an official ID card (not a personal face selfie or standard human portrait).
- Verify the presence of text corresponding to a Full Name and Date of Birth (DOB).
- The image must clearly show a structured document layout, not a casual photograph of a person.
- Respond ONLY with valid JSON — no markdown, no explanation outside the JSON object.
- Respond with {"valid": true} if it is a valid ID card front side.
- Respond with {"valid": false, "reason": "Missing required text or invalid document type"} if it is not.`;

const SYSTEM_PROMPT_BACK = `You are an automated ID Card Validation Assistant. Your job is to inspect user-uploaded images and determine if they are valid identity card scans based on strict criteria.

For the Back Side Image:
- Inspect the image specifically for a visible, scannable QR Code or barcode.
- Ensure it represents the reverse side of an ID card and is not a personal photo.
- The image must clearly show a document with machine-readable features such as a QR code, barcode, serial number, or administrative text.
- Respond ONLY with valid JSON — no markdown, no explanation outside the JSON object.
- Respond with {"valid": true} if a QR code or barcode is detected on an ID back side.
- Respond with {"valid": false, "reason": "QR Code not detected or invalid document back side"} if it is not.`;

// ─── Controller ───────────────────────────────────────────────────────────────
/**
 * @desc    Validate a single ID card image (front or back) using GPT-4o Vision
 * @route   POST /api/auth/validate-id
 * @access  Public  (called before the user is authenticated during registration)
 * @body    { side: 'front' | 'back', imageBase64: string (data-URL or raw base64) }
 */
const validateId = async (req, res) => {
  try {
    const { side, imageBase64 } = req.body;

    if (!side || !imageBase64) {
      return res.status(400).json({
        success: false,
        message: '`side` (front | back) and `imageBase64` are required.'
      });
    }

    if (side !== 'front' && side !== 'back') {
      return res.status(400).json({
        success: false,
        message: '`side` must be "front" or "back".'
      });
    }

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
      console.warn('[ID Validation] OPENAI_API_KEY is not configured — skipping validation.');
      return res.status(200).json({ success: true, valid: true, skipped: true });
    }

    // Accept both plain base64 and data-URL formats
    const dataUrl = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    const systemPrompt = side === 'front' ? SYSTEM_PROMPT_FRONT : SYSTEM_PROMPT_BACK;

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 100,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Please inspect this image and respond with the required JSON only.`
            },
            {
              type: 'image_url',
              image_url: { url: dataUrl, detail: 'low' }
            }
          ]
        }
      ]
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '{}';

    // Strip any accidental markdown fences the model may add
    const cleaned = raw.replace(/```json|```/g, '').trim();

    let result;
    try {
      result = JSON.parse(cleaned);
    } catch {
      console.error('[ID Validation] Could not parse model response:', raw);
      // If we can't parse the response, let it through rather than blocking the user
      return res.status(200).json({ success: true, valid: true, skipped: true });
    }

    console.log(`[ID Validation] side=${side} valid=${result.valid} reason=${result.reason || '—'}`);

    return res.status(200).json({
      success: true,
      valid:  result.valid === true,
      reason: result.reason || null
    });

  } catch (error) {
    console.error('[ID Validation] Error:', error.message);

    // On any OpenAI/network error, allow the upload to proceed rather than blocking the user
    return res.status(200).json({
      success: true,
      valid:   true,
      skipped: true,
      message: 'Validation service unavailable — proceeding without check.'
    });
  }
};

module.exports = { validateId };
