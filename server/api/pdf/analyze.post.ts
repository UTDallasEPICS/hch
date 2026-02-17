import { GoogleGenAI, createPartFromBase64, createPartFromText } from '@google/genai'

const VISION_PROMPT = `You are analyzing a PDF form layout for "Hope. Cope. Heal." - a medical/counseling application.

VISUAL ANALYSIS RULES:
1. **Radio (single choice)**: List of labels with circles/radio buttons next to them → type: "radio"
2. **Radio with Other**: Same as radio, BUT if the last option is "Other" or a blank line for write-in → type: "radio_other"
3. **Checkbox (multiple choice)**: List of labels with squares/checkboxes → type: "checkbox"
4. **Checkbox with Other**: Same as checkbox with "Other" or blank as last option → type: "checkbox_other"
5. **Multiple Choice Grid**: A table/matrix where rows are questions and columns are scale options (e.g. "Never", "Sometimes", "Always"). Rows = questions, Columns = response scale → type: "multiple_choice_grid"
6. **Checkbox Grid**: Same layout as multiple_choice_grid but multiple selections per row allowed → type: "checkbox_grid"
7. **Long Paragraph**: A large empty box or textarea for extended text → type: "long_paragraph"
8. **Short Answer**: A single-line blank or short input field → type: "short_answer"

GRID DETECTION (critical for counseling/assessment forms):
- Look for intersecting labels: Rows = questions (e.g. "How often do you feel anxious?"), Columns = scale (e.g. "Never", "Sometimes", "Often", "Always")
- Extract gridRows and gridCols as arrays of strings
- If ambiguous whether single or multiple selection per row, prefer "multiple_choice_grid" and set needsReview: true

"OTHER" OPTION LOGIC:
- If the last option in a list is "Other", "Other (please specify)", or a blank line for write-in → use "radio_other" or "checkbox_other" instead of standard "radio"/"checkbox"

AMBIGUITY:
- If you cannot confidently determine the type, set needsReview: true so the user can verify

OUTPUT FORMAT: Return ONLY a valid JSON array, no markdown or extra text:
[
  { "id": "uuid-v4", "text": "Question label", "type": "radio", "options": ["Option A", "Option B"], "section": "Personal Info" },
  { "id": "uuid-v4", "text": "Grid question", "type": "multiple_choice_grid", "gridRows": ["Row 1", "Row 2"], "gridCols": ["Never", "Sometimes", "Always"], "section": "Symptoms" }
]

Each question MUST have: id (UUID), text (string), type (one of the types above).
For radio/checkbox: include options array.
For *_grid types: include gridRows and gridCols arrays.
Section is optional. Set needsReview: true for ambiguous fields.`

export default defineEventHandler(async (event) => {
  const body = await readBody<{ images: string[] }>(event)
  const { images } = body || {}

  if (!Array.isArray(images) || images.length === 0) {
    throw createError({ statusCode: 400, message: 'At least one base64 image is required' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message:
        'GEMINI_API_KEY is not set. Add it to your .env file for PDF-to-Form conversion.',
    })
  }

  const parts = [createPartFromText(VISION_PROMPT)]

  for (const img of images) {
    if (typeof img === 'string' && img.startsWith('data:')) {
      const match = img.match(/^data:(image\/[a-z]+);base64,(.+)$/)
      if (match?.[1] && match?.[2]) {
        parts.push(createPartFromBase64(match[2], match[1]))
      }
    }
  }

  const ai = new GoogleGenAI({ apiKey })

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts }],
      config: { maxOutputTokens: 4096 },
    })

    const text = response.text
    const raw = (text?.trim() ?? '') || '[]'
    let parsed: unknown[]
    try {
      const jsonStr = raw.replace(/^```json?\s*|\s*```$/g, '').trim()
      parsed = JSON.parse(jsonStr)
    } catch {
      throw createError({
        statusCode: 502,
        message: 'Vision API returned invalid JSON. Please try again.',
      })
    }

    if (!Array.isArray(parsed)) {
      throw createError({
        statusCode: 502,
        message: 'Expected an array of questions from Vision API.',
      })
    }

    return { questions: parsed }
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'statusCode' in e) {
      throw e
    }
    const err = e instanceof Error ? e : new Error('Unknown error')
    throw createError({
      statusCode: 502,
      message: `Vision API error: ${err.message}`,
    })
  }
})
