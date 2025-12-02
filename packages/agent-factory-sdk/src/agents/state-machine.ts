import { setup, assign } from 'xstate';
import { fromPromise } from 'xstate/actors';
import { AgentContext, AgentEvents } from './types';
import {
  detectIntent,
} from './actors/detect-intent.actor';
import {
  summarizeIntent,
} from './actors/summarize-intent.actor';
import {
  greeting,
} from './actors/greeting.actor';
import {
  ReadDataAgent,
} from './actors/read-data-agent.actor';
import {
  loadContext,
} from './actors/load-context.actor';
import { MessagePersistenceService } from '../services/message-persistence.service';
import { Repositories } from '@qwery/domain/repositories';
import type { TelemetryManager } from '@qwery/telemetry-opentelemetry';
import { AGENT_EVENTS } from '@qwery/telemetry-opentelemetry/events/agent.events';
import { IntentSchema } from './types';
import type { UIMessage } from 'ai';
import { context as otelContext, trace } from '@opentelemetry/api';

export const createStateMachine = (
  conversationId: string,
  repositories: Repositories,
  telemetry?: TelemetryManager,
) => {
  // Create telemetry-wrapped actors
  const detectIntentActor = fromPromise(
    async ({
      input,
    }: {
      input: {
        inputMessage: string;
      };
    }): Promise<AgentContext['intent']> => {
      if (!telemetry) {
        const result = await detectIntent(input.inputMessage);
        return result.object;
      }

      const startTime = Date.now();
      // Get the active context (should have parent spans from conversation/message)
      const parentContext = otelContext.active();
      // Create span within the parent context to ensure proper nesting
      const tracer = trace.getTracer('qwery-telemetry');
      const span = tracer.startSpan(
        'agent.actor.detectIntent',
        {
          attributes: {
            'agent.actor.id': 'detectIntent',
            'agent.actor.type': 'detectIntent',
            'agent.actor.input': JSON.stringify({ inputMessage: input.inputMessage }),
            'agent.conversation.id': conversationId,
          },
        },
        parentContext,
      );

      telemetry.captureEvent({
        name: AGENT_EVENTS.ACTOR_INVOKED,
        attributes: {
          'agent.actor.id': 'detectIntent',
          'agent.actor.type': 'detectIntent',
          'agent.conversation.id': conversationId,
        },
      });

      // Run within the span's context to ensure proper nesting
      return otelContext.with(
        trace.setSpan(parentContext, span),
        async () => {
          try {
            const result = await detectIntent(input.inputMessage);
            const duration = Date.now() - startTime;

            // Record token usage if available
            if (result.usage) {
              // LanguageModelV2Usage structure varies by provider
              // Try to extract tokens safely
              const usage = result.usage as any;
              const promptTokens = usage.promptTokens ?? usage.prompt_tokens ?? 0;
              const completionTokens = usage.completionTokens ?? usage.completion_tokens ?? 0;
              
              if (promptTokens > 0 || completionTokens > 0) {
                telemetry.recordTokenUsage(
                  promptTokens,
                  completionTokens,
                  {
                    'agent.llm.model.name': 'gpt-5-mini',
                    'agent.llm.provider.id': 'azure',
                    'agent.actor.id': 'detectIntent',
                    'agent.conversation.id': conversationId,
                  },
                );
              }
            }

            telemetry.captureEvent({
              name: AGENT_EVENTS.ACTOR_COMPLETED,
              attributes: {
                'agent.actor.id': 'detectIntent',
                'agent.actor.type': 'detectIntent',
                'agent.actor.duration_ms': String(duration),
                'agent.actor.status': 'success',
                'agent.conversation.id': conversationId,
              },
            });

            telemetry.endSpan(span, true);
            return result.object;
          } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);

            telemetry.captureEvent({
              name: AGENT_EVENTS.ACTOR_FAILED,
              attributes: {
                'agent.actor.id': 'detectIntent',
                'agent.actor.type': 'detectIntent',
                'agent.actor.duration_ms': String(duration),
                'agent.actor.status': 'error',
                'error.type': error instanceof Error ? error.name : 'UnknownError',
                'error.message': errorMessage,
                'agent.conversation.id': conversationId,
              },
            });

            telemetry.endSpan(span, false);
            throw error;
          }
        }
      );
    },
  );

  const summarizeIntentActor = fromPromise(
    async ({
      input,
    }: {
      input: {
        inputMessage: string;
        intent: AgentContext['intent'];
        previousMessages: UIMessage[];
      };
    }) => {
      if (!telemetry) {
        return summarizeIntent(input.inputMessage, input.intent);
      }

      const startTime = Date.now();
      // Get the active context (should have parent spans from conversation/message)
      const parentContext = otelContext.active();
      // Create span within the parent context to ensure proper nesting
      const tracer = trace.getTracer('qwery-telemetry');
      const span = tracer.startSpan(
        'agent.actor.summarizeIntent',
        {
          attributes: {
            'agent.actor.id': 'summarizeIntent',
            'agent.actor.type': 'summarizeIntent',
            'agent.conversation.id': conversationId,
          },
        },
        parentContext,
      );

      telemetry.captureEvent({
        name: AGENT_EVENTS.ACTOR_INVOKED,
        attributes: {
          'agent.actor.id': 'summarizeIntent',
          'agent.actor.type': 'summarizeIntent',
          'agent.conversation.id': conversationId,
        },
      });

      // Run within the span's context to ensure proper nesting
      return otelContext.with(
        trace.setSpan(parentContext, span),
        async () => {
          try {
            const result = await summarizeIntent(input.inputMessage, input.intent);
        const duration = Date.now() - startTime;

        // Capture token usage from streamText result (usage is a promise)
        // For Azure/Ollama providers, usage will be available when stream completes
        if (result.usage) {
          result.usage.then((usage) => {
            if (usage && telemetry) {
              const promptTokens = (usage as any).promptTokens ?? (usage as any).prompt_tokens ?? 0;
              const completionTokens = (usage as any).completionTokens ?? (usage as any).completion_tokens ?? 0;
              
              if (promptTokens > 0 || completionTokens > 0) {
                telemetry.recordTokenUsage(
                  promptTokens,
                  completionTokens,
                  {
                    'agent.llm.model.name': 'gpt-5-mini',
                    'agent.llm.provider.id': 'azure',
                    'agent.actor.id': 'summarizeIntent',
                    'agent.conversation.id': conversationId,
                  },
                );
              }
            }
          }).catch(() => {
            // Ignore errors in usage capture
          });
        }

        telemetry.captureEvent({
          name: AGENT_EVENTS.ACTOR_COMPLETED,
          attributes: {
            'agent.actor.id': 'summarizeIntent',
            'agent.actor.type': 'summarizeIntent',
            'agent.actor.duration_ms': String(duration),
            'agent.actor.status': 'success',
            'agent.conversation.id': conversationId,
          },
        });

            telemetry.endSpan(span, true);
            return result;
          } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);

            telemetry.captureEvent({
              name: AGENT_EVENTS.ACTOR_FAILED,
              attributes: {
                'agent.actor.id': 'summarizeIntent',
                'agent.actor.type': 'summarizeIntent',
                'agent.actor.duration_ms': String(duration),
                'agent.actor.status': 'error',
                'error.type': error instanceof Error ? error.name : 'UnknownError',
                'error.message': errorMessage,
                'agent.conversation.id': conversationId,
              },
            });

            telemetry.endSpan(span, false);
            throw error;
          }
        }
      );
    },
  );

  const greetingActor = fromPromise(
    async ({
      input,
    }: {
      input: {
        inputMessage: string;
      };
    }) => {
      if (!telemetry) {
        return greeting(input.inputMessage);
      }

      const startTime = Date.now();
      // Get the active context (should have parent spans from conversation/message)
      const parentContext = otelContext.active();
      // Create span within the parent context to ensure proper nesting
      const tracer = trace.getTracer('qwery-telemetry');
      const span = tracer.startSpan(
        'agent.actor.greeting',
        {
          attributes: {
            'agent.actor.id': 'greeting',
            'agent.actor.type': 'greeting',
            'agent.conversation.id': conversationId,
          },
        },
        parentContext,
      );

      telemetry.captureEvent({
        name: AGENT_EVENTS.ACTOR_INVOKED,
        attributes: {
          'agent.actor.id': 'greeting',
          'agent.actor.type': 'greeting',
          'agent.conversation.id': conversationId,
        },
      });

      // Run within the span's context to ensure proper nesting
      return otelContext.with(
        trace.setSpan(parentContext, span),
        async () => {
          try {
            const result = await greeting(input.inputMessage);
        const duration = Date.now() - startTime;

        // Capture token usage from streamText result (usage is a promise)
        // For Azure/Ollama providers, usage will be available when stream completes
        if (result.usage) {
          result.usage.then((usage) => {
            if (usage && telemetry) {
              const promptTokens = (usage as any).promptTokens ?? (usage as any).prompt_tokens ?? 0;
              const completionTokens = (usage as any).completionTokens ?? (usage as any).completion_tokens ?? 0;
              
              if (promptTokens > 0 || completionTokens > 0) {
                telemetry.recordTokenUsage(
                  promptTokens,
                  completionTokens,
                  {
                    'agent.llm.model.name': 'gpt-5-mini',
                    'agent.llm.provider.id': 'azure',
                    'agent.actor.id': 'greeting',
                    'agent.conversation.id': conversationId,
                  },
                );
              }
            }
          }).catch(() => {
            // Ignore errors in usage capture
          });
        }

        telemetry.captureEvent({
          name: AGENT_EVENTS.ACTOR_COMPLETED,
          attributes: {
            'agent.actor.id': 'greeting',
            'agent.actor.type': 'greeting',
            'agent.actor.duration_ms': String(duration),
            'agent.actor.status': 'success',
            'agent.conversation.id': conversationId,
          },
        });

            telemetry.endSpan(span, true);
            return result;
          } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);

            telemetry.captureEvent({
              name: AGENT_EVENTS.ACTOR_FAILED,
              attributes: {
                'agent.actor.id': 'greeting',
                'agent.actor.type': 'greeting',
                'agent.actor.duration_ms': String(duration),
                'agent.actor.status': 'error',
                'error.type': error instanceof Error ? error.name : 'UnknownError',
                'error.message': errorMessage,
                'agent.conversation.id': conversationId,
              },
            });

            telemetry.endSpan(span, false);
            throw error;
          }
        }
      );
    },
  );

  const readDataAgentActor = fromPromise(
    async ({
      input,
    }: {
      input: {
        inputMessage: string;
        conversationId: string;
        previousMessages: UIMessage[];
      };
    }) => {
      if (!telemetry) {
        const agent = new ReadDataAgent({
          conversationId: input.conversationId,
        });
        const agentInstance = await agent.getAgent();
        return agentInstance.stream({
          prompt: input.inputMessage,
        });
      }

      const startTime = Date.now();
      // Get the active context (should have parent spans from conversation/message)
      const parentContext = otelContext.active();
      // Create span within the parent context to ensure proper nesting
      const tracer = trace.getTracer('qwery-telemetry');
      const span = tracer.startSpan(
        'agent.actor.readData',
        {
          attributes: {
            'agent.actor.id': 'readData',
            'agent.actor.type': 'readData',
            'agent.conversation.id': conversationId,
          },
        },
        parentContext,
      );

      telemetry.captureEvent({
        name: AGENT_EVENTS.ACTOR_INVOKED,
        attributes: {
          'agent.actor.id': 'readData',
          'agent.actor.type': 'readData',
          'agent.conversation.id': conversationId,
        },
      });

      // Run within the span's context to ensure proper nesting
      return otelContext.with(
        trace.setSpan(parentContext, span),
        async () => {
          try {
            const agent = new ReadDataAgent({
              conversationId: input.conversationId,
            });
            const agentInstance = await agent.getAgent();
            const result = agentInstance.stream({
              prompt: input.inputMessage,
            });
            const duration = Date.now() - startTime;

            telemetry.captureEvent({
              name: AGENT_EVENTS.ACTOR_COMPLETED,
              attributes: {
                'agent.actor.id': 'readData',
                'agent.actor.type': 'readData',
                'agent.actor.duration_ms': String(duration),
                'agent.actor.status': 'success',
                'agent.conversation.id': conversationId,
              },
            });

            telemetry.endSpan(span, true);
            return result;
          } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);

            telemetry.captureEvent({
              name: AGENT_EVENTS.ACTOR_FAILED,
              attributes: {
                'agent.actor.id': 'readData',
                'agent.actor.type': 'readData',
                'agent.actor.duration_ms': String(duration),
                'agent.actor.status': 'error',
                'error.type': error instanceof Error ? error.name : 'UnknownError',
                'error.message': errorMessage,
                'agent.conversation.id': conversationId,
              },
            });

            telemetry.endSpan(span, false);
            throw error;
          }
        }
      );
    },
  );

  const loadContextActor = fromPromise(
    async ({
      input,
    }: {
      input: {
        repositories: Repositories;
        conversationId: string;
      };
    }) => {
      if (!telemetry) {
        const result = await loadContext(input.repositories, input.conversationId);
        return MessagePersistenceService.convertToUIMessages(result);
      }

      const startTime = Date.now();
      // Get the active context (should have parent spans from conversation/message)
      const parentContext = otelContext.active();
      // Create span within the parent context to ensure proper nesting
      const tracer = trace.getTracer('qwery-telemetry');
      const span = tracer.startSpan(
        'agent.actor.loadContext',
        {
          attributes: {
            'agent.actor.id': 'loadContext',
            'agent.actor.type': 'loadContext',
            'agent.conversation.id': conversationId,
          },
        },
        parentContext,
      );

      telemetry.captureEvent({
        name: AGENT_EVENTS.ACTOR_INVOKED,
        attributes: {
          'agent.actor.id': 'loadContext',
          'agent.actor.type': 'loadContext',
          'agent.conversation.id': conversationId,
        },
      });

      // Run within the span's context to ensure proper nesting
      return otelContext.with(
        trace.setSpan(parentContext, span),
        async () => {
          try {
            const result = await loadContext(input.repositories, input.conversationId);
            const messages = MessagePersistenceService.convertToUIMessages(result);
            const duration = Date.now() - startTime;

            telemetry.captureEvent({
              name: AGENT_EVENTS.ACTOR_COMPLETED,
              attributes: {
                'agent.actor.id': 'loadContext',
                'agent.actor.type': 'loadContext',
                'agent.actor.duration_ms': String(duration),
                'agent.actor.status': 'success',
                'agent.context.message_count': messages.length,
                'agent.conversation.id': conversationId,
              },
            });

            telemetry.endSpan(span, true);
            return messages;
          } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);

            telemetry.captureEvent({
              name: AGENT_EVENTS.ACTOR_FAILED,
              attributes: {
                'agent.actor.id': 'loadContext',
                'agent.actor.type': 'loadContext',
                'agent.actor.duration_ms': String(duration),
                'agent.actor.status': 'error',
                'error.type': error instanceof Error ? error.name : 'UnknownError',
                'error.message': errorMessage,
                'agent.conversation.id': conversationId,
              },
            });

            telemetry.endSpan(span, false);
            throw error;
          }
        }
      );
    },
  );

  const defaultSetup = setup({
    types: {
      context: {} as AgentContext,
      events: {} as AgentEvents,
    },
    actors: {
      detectIntentActor,
      summarizeIntentActor,
      greetingActor,
      readDataAgentActor,
      loadContextActor,
    },
    guards: {
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
      isGreeting: ({ event }: { event: any }) =>
        event.output?.intent === 'greeting',

      isOther: ({ event }) => event.output?.intent === 'other',

      isReadData: ({ event }) => event.output?.intent === 'read-data',
    },
  });
  return defaultSetup.createMachine({
    /** @xstate-layout N4IgpgJg5mDOIC5QDMCGBjALgewE4E8BaVGAO0wDoAbbVCAYW3LAA9MBiCJsCgS1IBu2ANY8AMgHkAggBEA+vQkA5ACoBRABoqA2gAYAuolAAHbLF6ZeTIyBaIALLoBsFAIxOPAVgDMADm+eugDsQa4ANCD4iK5BLp5Bvq4BTq723gCcPvYAvtkRaFh4RCRg5NS0DEyYrBxguLh4FMZUqJjIeAC2FJKyCsrqWnqGSCCm5pbWI3YIji7uXn4BwaERUQgATE6+FL7rnp6u6Sn2IYm5+Rg4BMRklLwQVGDsAKoAymoASnIAkkoACs8dAYbGMLFZSDZpp51qtEIkKN51ut0utdPYFgdPOcQAUrsVbnwHk9XioJH8hiCzGDJqBpu57K4KOldL4nOkAidvGjYTN4Y4gvZfIF9hkMtjcUUbqVKLgAK6kUj8KAvd5fX4AoHDExUiYQqaITweCi6fbpUKuVmpbw8vxBY3rbwWoLBda+U7iy6SkplOUKpXsElkikjUG6yHRdb2dI7TEMzZBTKeXw21yeChOLkxXSpdL2dZBbwewrXb0y+WK0hQCgQMDVLDfZjkTjcPiCEQ8ADiahUP1UalUwe143B4ZmnmjuhNMUcvjR3jSPK29nTh3RqTdnnsaSLeKlPvLSurtbA9cbHC4pB4-CEogoXZ7v3UA9cWtGOpH+rHE6nApZc4XkSIAm0YMq4WaoiEaTpDuXoEr6FZVjWdaYA21RNheV5tre969k+OjrK+oYfrSDjjsaP4zv+1qAQgzLLqEaJRm66yHOOMElnBB6VkeyGodK7B1A0uBNC0bSdHe3a4f2mqUsONK2BGZFCqmcZOAm+zJjR3hOGmW6bCcRy6CxSLsfi0oUPBh6wLKHQdKguC8AAXmAfHoS217thQrzPAAsj5UgfN8ABaahSQOwIhu+8l0ps0bKZurjxommlrPY8TpsyuiOoZ46CkEpl7mWfrcdZtn2U5LlngJ9SNM0rTtLgXTeX5AXBaFj7SYOb5yXqJEIIlCYxipiVqclPKbtG7ICqmhlmiEBWlhZXFVlAuBgLW-oYa2N48K8UhiM8ahdUR0URr4cWxiN6lJoueZuL4BnpEcSROM4C2ccVK1rRtlbVUJIn1eJe0HUdEVDtSvUKf1yIXcNSUaTyBbLmkSJ+O4Jr6e95mWdxa10DIrSoM2l7bZ5HxqL0MhSCoUjHVFkMxU9Q0JfDN00bsLijfE8RorOuZY-un0WWA+OE39tWiQ1XTk5T1O02D3UQ6OiUZMzqnXSliDpBaTL5tmGRZWa0K5HkICkNgNbwCMEocdKslK5+9g8oQLiTm77vuyxAuUDQdCMMwbD22Gn7QjySJxSk0LuAcQQw4Wps22ZZT3I8QfEVDqZJhQmyZg6+aRtRqXwoa52RscKQCk43tLZ9aenQg448uidqhA9r3zrMiLVzjiHHqeaGYHXDPRME437MaDJ+CyrgmukD3d8tFClXZDnOa5g+RT1o4JtsG7Zs6uYBAmi4Fm42abA9vgPcy6wL0Lq3rZYlZD6OV+6Om3gH2l7KikEiNmgiIUugURbHiE4PMd8ELC1FpgVAL9Pz+HWBQPSscwJBGhIETWtEjLpgeicLYsQtxvQTp6W2ZRYA4GMMYSA8C+rTmXDpCuDIvApCbrOBEewtxHASE4MuOQTZAA */
    id: 'factory-agent',
    context: {
      inputMessage: '',
      conversationId: conversationId,
      response: '',
      previousMessages: [],
      streamResult: undefined,
      intent: {
        intent: 'other',
        complexity: 'simple',
      },
      error: undefined,
    },
    initial: 'loadContext',
    states: {
      loadContext: {
        invoke: {
          src: 'loadContextActor',
          id: 'LOAD_CONTEXT',
          input: ({ context }: { context: AgentContext }) => ({
            repositories: repositories,
            conversationId: context.conversationId,
          }),
          onDone: {
            target: 'idle',
            actions: assign({
              previousMessages: ({ event }) => event.output,
            }),
          },
          onError: {
            target: 'idle',
          },
        },
      },
      idle: {
        on: {
          USER_INPUT: {
            target: 'running',
            actions: assign({
              previousMessages: ({ event }) => event.messages,
              inputMessage: ({ event }) =>
                event.messages[event.messages.length - 1]?.parts[0]?.text ?? '',
              streamResult: () => undefined, // Clear previous result when starting new request
              error: () => undefined,
            }),
          },
          STOP: 'stopped',
        },
      },
      running: {
        initial: 'detectIntent',
        on: {
          USER_INPUT: {
            target: 'running',
            actions: assign({
              previousMessages: ({ event }) => event.messages,
              inputMessage: ({ event }) =>
                event.messages[event.messages.length - 1]?.parts[0]?.text ?? '',
              streamResult: undefined,
            }),
          },
          STOP: 'idle',
        },
        states: {
          detectIntent: {
            invoke: {
              src: 'detectIntentActor',
              id: 'GET_INTENT',
              input: ({ context }: { context: AgentContext }) => ({
                inputMessage: context.inputMessage,
              }),
              onDone: [
                {
                  guard: 'isOther',
                  target: 'summarizeIntent',
                  actions: assign({
                    intent: ({ event }) => event.output,
                  }),
                },
                {
                  guard: 'isGreeting',
                  target: 'greeting',
                  actions: assign({
                    intent: ({ event }) => event.output,
                  }),
                },
                {
                  guard: 'isReadData',
                  target: 'readData',
                  actions: assign({
                    intent: ({ event }) => event.output,
                  }),
                },
              ],
              onError: {
                target: '#factory-agent.idle',
                actions: assign({
                  error: ({ event }) => {
                    const errorMsg =
                      event.error instanceof Error
                        ? event.error.message
                        : String(event.error);
                    console.error('detectIntent error:', errorMsg, event.error);
                    return errorMsg;
                  },
                  streamResult: undefined,
                }),
              },
            },
          },
          summarizeIntent: {
            invoke: {
              src: 'summarizeIntentActor',
              id: 'SUMMARIZE_INTENT',
              input: ({ context }: { context: AgentContext }) => ({
                inputMessage: context.inputMessage,
                intent: context.intent,
                previousMessages: context.previousMessages,
              }),
              onDone: {
                target: '#factory-agent.idle',
                actions: assign({
                  streamResult: ({ event }) => event.output,
                }),
              },
              onError: {
                target: '#factory-agent.idle',
                actions: assign({
                  error: ({ event }) => {
                    const errorMsg =
                      event.error instanceof Error
                        ? event.error.message
                        : String(event.error);
                    console.error(
                      'summarizeIntent error:',
                      errorMsg,
                      event.error,
                    );
                    return errorMsg;
                  },
                  streamResult: undefined,
                }),
              },
            },
          },
          greeting: {
            invoke: {
              src: 'greetingActor',
              id: 'SALUE',
              input: ({ context }: { context: AgentContext }) => ({
                inputMessage: context.inputMessage,
              }),
              onDone: {
                target: '#factory-agent.idle',
                actions: assign({
                  streamResult: ({ event }) => event.output,
                }),
              },
              onError: {
                target: '#factory-agent.idle',
                actions: assign({
                  error: ({ event }) => {
                    const errorMsg =
                      event.error instanceof Error
                        ? event.error.message
                        : String(event.error);
                    console.error('greeting error:', errorMsg, event.error);
                    return errorMsg;
                  },
                  streamResult: undefined,
                }),
              },
            },
          },
          readData: {
            invoke: {
              src: 'readDataAgentActor',
              id: 'READ_DATA',
              input: ({ context }: { context: AgentContext }) => ({
                inputMessage: context.inputMessage,
                conversationId: context.conversationId,
                previousMessages: context.previousMessages,
              }),
              onDone: {
                target: '#factory-agent.idle',
                actions: assign({
                  streamResult: ({ event }) => event.output,
                }),
              },
              onError: {
                target: '#factory-agent.idle',
                actions: assign({
                  error: ({ event }) => {
                    const errorMsg =
                      event.error instanceof Error
                        ? event.error.message
                        : String(event.error);
                    console.error('readData error:', errorMsg, event.error);
                    return errorMsg;
                  },
                  streamResult: undefined,
                }),
              },
            },
          },
        },
      },
      stopped: {
        type: 'final',
      },
    },
  });
};
