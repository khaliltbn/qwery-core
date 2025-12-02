import { generateObject } from 'ai';
import { z } from 'zod';
import { fromPromise } from 'xstate/actors';
import { IntentSchema } from '../types';
import { DETECT_INTENT_PROMPT } from '../prompts/detect-intent.prompt';
import { resolveModel } from '../../services/agent-factory';

export const detectIntent = async (text: string) => {
  try {
    // Add timeout to detect hanging calls
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('generateObject timeout after 30 seconds')),
        30000,
      );
    });

    const generatePromise = generateObject({
      model: await resolveModel('azure/gpt-5-mini'),
      schema: IntentSchema,
      prompt: DETECT_INTENT_PROMPT(text),
    });

    const result = await Promise.race([generatePromise, timeoutPromise]);
    return {
      object: result.object,
      usage: result.usage,
    };
  } catch (error) {
    console.error(
      '[detectIntent] ERROR:',
      error instanceof Error ? error.message : String(error),
    );
    if (error instanceof Error && error.stack) {
      console.error('[detectIntent] Stack:', error.stack);
    }
    throw error;
  }
};

export const detectIntentActor = fromPromise(
  async ({
    input,
  }: {
    input: {
      inputMessage: string;
    };
  }): Promise<z.infer<typeof IntentSchema>> => {
    try {
      const result = await detectIntent(input.inputMessage);
      return result.object;
    } catch (error) {
      console.error('[detectIntentActor] ERROR:', error);
      throw error;
    }
  },
);
