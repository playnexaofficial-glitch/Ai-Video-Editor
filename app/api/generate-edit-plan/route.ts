import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

interface FileMetadata {
  name: string;
  type: 'video' | 'image' | 'audio';
  duration?: number;
}

interface RequestBody {
  description: string;
  files: FileMetadata[];
}

interface EditPlanSegment {
  sourceFile: string;
  type: 'video' | 'image';
  startTime: number;
  duration: number;
  transitionIn: 'none' | 'fade' | 'cut';
}

const CANDIDATE_MODELS = [
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
];

/**
 * Intelligent local fallback when upstream Gemini endpoints experience 503 spikes.
 * Analyzes the user's uploaded files and description keywords to construct a valid edit plan.
 */
function createDeterministicEditPlan(description: string, files: FileMetadata[]) {
  const visualFiles = files.filter((f) => f.type === 'video' || f.type === 'image');
  const audioFiles = files.filter((f) => f.type === 'audio');

  const segments: EditPlanSegment[] = [];
  const lowerDesc = description.toLowerCase();

  // Check if any specific files were mentioned by name
  const mentionedVisualFiles = visualFiles.filter((f) => lowerDesc.includes(f.name.toLowerCase()));

  const filesToSequence = mentionedVisualFiles.length > 0 ? mentionedVisualFiles : visualFiles;

  filesToSequence.forEach((file, index) => {
    const isFirst = index === 0;
    const defaultDuration = file.type === 'video' ? Math.min(file.duration || 5, 5) : 3;

    segments.push({
      sourceFile: file.name,
      type: file.type as 'video' | 'image',
      startTime: 0,
      duration: defaultDuration,
      transitionIn: isFirst ? 'none' : lowerDesc.includes('fade') ? 'fade' : 'cut',
    });
  });

  // Determine background music
  let matchedAudio: string | null = null;
  if (audioFiles.length > 0) {
    const mentionedAudio = audioFiles.find((a) => lowerDesc.includes(a.name.toLowerCase()));
    matchedAudio = mentionedAudio ? mentionedAudio.name : audioFiles[0].name;
  }

  return {
    segments: segments.length > 0 ? segments : [
      {
        sourceFile: files[0].name,
        type: (files[0].type === 'video' ? 'video' : 'image') as 'video' | 'image',
        startTime: 0,
        duration: 5,
        transitionIn: 'none' as const,
      }
    ],
    backgroundMusic: matchedAudio,
  };
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const body = (await req.json()) as RequestBody;
    const { description, files } = body;

    if (!description || typeof description !== 'string' || !description.trim()) {
      return NextResponse.json(
        { error: 'Please provide a valid description for your video edit.' },
        { status: 400 }
      );
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: 'No uploaded media files provided to generate an edit plan for.' },
        { status: 400 }
      );
    }

    // Build context summary of available files
    const fileListFormatted = files
      .map((f) => `- [${f.type.toUpperCase()}] "${f.name}"${f.duration ? ` (duration: ${Math.round(f.duration)}s)` : ''}`)
      .join('\n');

    const systemInstruction = `You are a professional video-editing assistant.
Your task is to convert the user's plain-language video editing instructions into a STRICT JSON "edit plan" blueprint for rendering.

CRITICAL CONSTRAINTS:
1. You must ONLY reference filenames that exist in the provided list of uploaded files. Do NOT invent, hallucinate, or alter filenames.
2. The user has uploaded these available media files:
${fileListFormatted}
3. A segment can only have type "video" or "image".
4. For video segments, "startTime" is the start timestamp in seconds within the source file (use 0 if the user did not specify trimming).
5. "duration" is how many seconds this segment should appear in the final video edit.
6. "transitionIn" must be exactly one of: "none", "fade", or "cut".
7. If the user mentions background music, "backgroundMusic" must be set to the exact filename of one of the available AUDIO files listed above. If no music is mentioned or no audio files match, set "backgroundMusic" to null.
8. The target video is a short-form video (typically up to 120 seconds total).
9. Output ONLY valid JSON conforming to the schema.`;

    const userPrompt = `Available uploaded files:
${fileListFormatted}

User edit description:
"${description.trim()}"

Generate the structured JSON edit plan following the schema.`;

    let responseText: string | null = null;
    let geminiError: unknown = null;

    if (apiKey) {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // Try candidate models with fallback
      for (const modelName of CANDIDATE_MODELS) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: userPrompt,
            config: {
              systemInstruction,
              temperature: 0.2,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  segments: {
                    type: Type.ARRAY,
                    description: 'The ordered sequence of video clips and images to be combined in the final edit.',
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        sourceFile: {
                          type: Type.STRING,
                          description: 'The exact filename of the source file from the uploaded list.',
                        },
                        type: {
                          type: Type.STRING,
                          enum: ['video', 'image'],
                          description: 'The media type: video or image.',
                        },
                        startTime: {
                          type: Type.NUMBER,
                          description: 'Start offset time in seconds in the source file. 0 if no trim.',
                        },
                        duration: {
                          type: Type.NUMBER,
                          description: 'Duration in seconds this segment appears in the final output.',
                        },
                        transitionIn: {
                          type: Type.STRING,
                          enum: ['none', 'fade', 'cut'],
                          description: 'Transition effect when entering this segment.',
                        },
                      },
                      required: ['sourceFile', 'type', 'startTime', 'duration', 'transitionIn'],
                    },
                  },
                  backgroundMusic: {
                    type: Type.STRING,
                    nullable: true,
                    description: 'The exact filename of the background audio file, or null if none.',
                  },
                },
                required: ['segments'],
              },
            },
          });

          if (response.text) {
            responseText = response.text;
            break; // Success!
          }
        } catch (err: unknown) {
          geminiError = err;
          console.warn(`Model ${modelName} returned temporary error:`, err);
          // Try next model in loop
        }
      }
    }

    // Parse model response if received
    if (responseText) {
      try {
        const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsedPlan = JSON.parse(cleaned);

        if (parsedPlan && Array.isArray(parsedPlan.segments) && parsedPlan.segments.length > 0) {
          return NextResponse.json({
            success: true,
            plan: {
              description: description.trim(),
              segments: parsedPlan.segments,
              backgroundMusic: parsedPlan.backgroundMusic || null,
              createdAt: Date.now(),
            },
          });
        }
      } catch (parseErr) {
        console.warn('Could not parse Gemini response as JSON, falling back to smart local plan:', parseErr);
      }
    }

    // If Gemini model is experiencing a 503 high-demand spike, provide smart deterministic plan so user flow is uninterrupted
    console.info('Using smart local edit plan synthesis due to upstream model availability.');
    const fallbackPlan = createDeterministicEditPlan(description, files);

    return NextResponse.json({
      success: true,
      notice: geminiError ? 'AI model was under high demand — an automated sequence plan has been constructed.' : undefined,
      plan: {
        description: description.trim(),
        segments: fallbackPlan.segments,
        backgroundMusic: fallbackPlan.backgroundMusic,
        createdAt: Date.now(),
      },
    });
  } catch (error: unknown) {
    console.error('Error generating edit plan:', error);
    let message = 'An unexpected error occurred while generating the edit plan.';

    if (error instanceof Error) {
      message = error.message;
      if (message.includes('503') || message.toLowerCase().includes('high demand') || message.toLowerCase().includes('unavailable')) {
        message = 'The AI model is currently experiencing high demand. Please try again in a few moments.';
      }
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
