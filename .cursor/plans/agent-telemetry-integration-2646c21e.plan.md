<!-- 2646c21e-7f84-4b21-a97e-eb830c90e2e1 fa24fdc7-a5cf-4cd1-ae5c-fd75ce9229aa -->
# Agent Telemetry Integration Plan

## Overview

Integrate OpenTelemetry telemetry into the FactoryAgent and XState state machine, creating a nested span hierarchy that traces the complete agent flow: conversation → message → actor → LLM/DB calls.

## Architecture

**Span Hierarchy:**

```
CLI command span (existing, via withCommandSpan)
 └─ Agent conversation span (new, in FactoryAgent.respond())
      └─ Message span (new, per USER_INPUT)
           └─ Actor spans (new, in XState invoke)
                └─ LLM spans (new, in model providers)
                     └─ DB spans (optional, in repositories)
```

## Implementation Steps

### Step 1: Add TelemetryManager to FactoryAgent

**File:** `packages/agent-factory-sdk/src/agents/factory-agent.ts`

- Add `telemetry?: TelemetryManager` to `FactoryAgentOptions` interface
- Store telemetry instance in `FactoryAgent` class
- Make telemetry optional to maintain backward compatibility

**Changes:**

- Import `TelemetryManager` from `@qwery/telemetry-opentelemetry`
- Update constructor to accept and store telemetry
- Pass telemetry to state machine creation

### Step 2: Add Agent-Specific Event Constants

**File:** `apps/telemetry/src/events/agent.events.ts` (new file)

Create event constants for agent operations:

- `AGENT_CONVERSATION_STARTED`
- `AGENT_CONVERSATION_COMPLETED`
- `AGENT_MESSAGE_RECEIVED`
- `AGENT_MESSAGE_PROCESSED`
- `AGENT_ACTOR_INVOKED`
- `AGENT_ACTOR_COMPLETED`
- `AGENT_ACTOR_FAILED`
- `AGENT_LLM_CALL_STARTED`
- `AGENT_LLM_CALL_COMPLETED`
- `AGENT_LLM_TOKENS_USED`

**Export from:** `apps/telemetry/src/index.ts`

### Step 3: Instrument FactoryAgent.respond()

**File:** `packages/agent-factory-sdk/src/agents/factory-agent.ts`

- Wrap `respond()` method with conversation span
- Capture conversation attributes: `conversation.id`, `agent.id`, `message.count`
- Add message span when processing USER_INPUT
- Capture message attributes: `message.text`, `message.index`
- End spans on completion/error

**Implementation:**

```typescript
async respond(opts: { messages: UIMessage[] }): Promise<Response> {
  if (!this.telemetry) {
    // Fallback to original behavior if no telemetry
    return this._respondInternal(opts);
  }

  const conversationSpan = this.telemetry.startSpan('agent.conversation', {
    'conversation.id': this.conversationSlug,
    'agent.id': this.id,
    'message.count': opts.messages.length,
  });

  this.telemetry.captureEvent({
    name: AGENT_EVENTS.AGENT_CONVERSATION_STARTED,
    attributes: { 'conversation.id': this.conversationSlug },
  });

  try {
    const response = await this._respondInternal(opts, conversationSpan);
    this.telemetry.endSpan(conversationSpan, true);
    this.telemetry.captureEvent({
      name: AGENT_EVENTS.AGENT_CONVERSATION_COMPLETED,
      attributes: { 'conversation.id': this.conversationSlug },
    });
    return response;
  } catch (error) {
    this.telemetry.endSpan(conversationSpan, false);
    throw error;
  }
}
```

### Step 4: Pass Telemetry to State Machine

**File:** `packages/agent-factory-sdk/src/agents/state-machine.ts`

- Add `telemetry?: TelemetryManager` parameter to `createStateMachine()`
- Store telemetry in machine context or pass to actors
- Update `FactoryAgent` constructor to pass telemetry

### Step 5: Instrument XState Actors

**File:** `packages/agent-factory-sdk/src/agents/state-machine.ts`

Wrap each actor invocation in state machine with actor span:

- `detectIntentActor` → span: `agent.actor.detectIntent`
- `summarizeIntentActor` → span: `agent.actor.summarizeIntent`
- `greetingActor` → span: `agent.actor.greeting`
- `readDataAgentActor` → span: `agent.actor.readData`
- `loadContextActor` → span: `agent.actor.loadContext`

**Implementation pattern:**

```typescript
detectIntent: {
  invoke: {
    src: async ({ input, self }) => {
      const span = telemetry?.startSpan('agent.actor.detectIntent', {
        'actor.id': 'detectIntent',
        'input.message': input.inputMessage,
      });
      try {
        const result = await detectIntentActor({ input });
        telemetry?.endSpan(span, true);
        return result;
      } catch (error) {
        telemetry?.endSpan(span, false);
        throw error;
      }
    },
    // ... rest of config
  }
}
```

**Note:** Since XState actors are invoked via `invoke.src`, we need to wrap the actor call, not modify the actor itself. However, we can also add spans inside actors if telemetry is passed.

### Step 6: Instrument Actor Functions

**Files:**

- `packages/agent-factory-sdk/src/agents/actors/detect-intent.actor.ts`
- `packages/agent-factory-sdk/src/agents/actors/summarize-intent.actor.ts`
- `packages/agent-factory-sdk/src/agents/actors/greeting.actor.ts`
- `packages/agent-factory-sdk/src/agents/actors/read-data-agent.actor.ts`
- `packages/agent-factory-sdk/src/agents/actors/load-context.actor.ts`

- Add telemetry parameter to actor functions (optional)
- Wrap actor logic with actor-specific spans
- Capture actor input/output attributes

**Alternative approach:** Since actors are invoked via XState, we can instrument at the state machine level (Step 5) instead of modifying each actor. This is cleaner and avoids passing telemetry through multiple layers.

### Step 7: Instrument LLM Calls in Model Providers

**Files:**

- `packages/agent-factory-sdk/src/services/agent-factory.ts`
- `packages/agent-factory-sdk/src/services/webllm-model.provider.ts`
- `packages/agent-factory-sdk/src/services/azure-model.provider.ts` (if exists)
- `packages/agent-factory-sdk/src/services/ollama-model.provider.ts` (if exists)

- Wrap `resolveModel()` calls with LLM span
- Instrument `doGenerate()` / `generateObject()` / `streamText()` calls
- Capture token usage via `telemetry.recordTokenUsage()`
- Add attributes: `model.name`, `provider.id`, `prompt.tokens`, `completion.tokens`

**Implementation:**

```typescript
// In webllm-model.provider.ts
doGenerate: async (options) => {
  const span = telemetry?.startSpan('agent.llm.call', {
    'model.name': modelName,
    'provider.id': 'webllm',
  });
  try {
    const response = await engine.chat.completions.create(...);
    const usage = response.usage || { promptTokens: 0, completionTokens: 0 };
    telemetry?.recordTokenUsage(
      usage.promptTokens,
      usage.completionTokens,
      { 'model.name': modelName, 'provider.id': 'webllm' }
    );
    telemetry?.endSpan(span, true);
    return result;
  } catch (error) {
    telemetry?.endSpan(span, false);
    throw error;
  }
}
```

**Challenge:** Model providers need access to telemetry. Options:

1. Pass telemetry through `resolveModel()` → `createProvider()` → model creation
2. Use OpenTelemetry context propagation (automatic span nesting)
3. Store telemetry in a global/singleton (not recommended)

**Recommended:** Use OpenTelemetry context propagation. The telemetry manager should already set up context, so spans created in actors/providers will automatically nest under the parent span.

### Step 8: Update CLI Integration

**File:** `apps/cli/src/services/interactive-repl.ts`

- Pass `container.telemetry` to `FactoryAgent` constructor when creating agent
- Ensure telemetry is available in CLI context

**File:** `apps/cli/src/services/notebook-runner.ts`

- Pass telemetry to `FactoryAgent` if used here

### Step 9: Add Message Span in respond()

**File:** `packages/agent-factory-sdk/src/agents/factory-agent.ts`

- Create message span when processing USER_INPUT
- Link message span to conversation span (automatic via context)
- Capture message text and index
- End span when message processing completes

**Implementation:**

```typescript
// Inside _respondInternal or respond()
const messageSpan = this.telemetry?.startSpan('agent.message', {
  'conversation.id': this.conversationSlug,
  'message.text': currentInputMessage,
  'message.index': opts.messages.length - 1,
});

this.telemetry?.captureEvent({
  name: AGENT_EVENTS.AGENT_MESSAGE_RECEIVED,
  attributes: { 'message.text': currentInputMessage },
});

// End span when streamResult is ready or on error
```

### Step 10: Testing and Validation

- Verify span hierarchy in traces
- Check that spans nest correctly
- Validate token usage metrics
- Ensure no performance degradation
- Test with telemetry disabled (backward compatibility)

## File Changes Summary

| File | Change Type | Description |

|------|-------------|-------------|

| `apps/telemetry/src/events/agent.events.ts` | New | Agent-specific event constants |

| `apps/telemetry/src/index.ts` | Update | Export agent events |

| `packages/agent-factory-sdk/src/agents/factory-agent.ts` | Update | Add telemetry support, instrument respond() |

| `packages/agent-factory-sdk/src/agents/state-machine.ts` | Update | Pass telemetry, instrument actor invocations |

| `packages/agent-factory-sdk/src/services/agent-factory.ts` | Update | Pass telemetry to providers (optional) |

| `packages/agent-factory-sdk/src/services/webllm-model.provider.ts` | Update | Instrument LLM calls |

| `apps/cli/src/services/interactive-repl.ts` | Update | Pass telemetry to FactoryAgent |

| `apps/cli/src/services/notebook-runner.ts` | Update | Pass telemetry if used |

## Design Decisions

1. **Telemetry Optional:** Make telemetry optional throughout to maintain backward compatibility
2. **Context Propagation:** Rely on OpenTelemetry context propagation for automatic span nesting
3. **Actor Instrumentation:** Instrument at state machine level (cleaner) rather than inside each actor
4. **LLM Instrumentation:** Instrument in model providers where actual LLM calls happen
5. **Event Constants:** Create agent-specific events separate from CLI events for clarity

## Dependencies

- `@qwery/telemetry-opentelemetry` package (already exists)
- OpenTelemetry context propagation (already set up in TelemetryManager)

## Notes

- Follow the existing pattern from CLI telemetry wrappers
- Use `withActionSpan` pattern where applicable
- Keep spans focused and avoid redundant wrapping
- Ensure telemetry doesn't break existing functionality

### To-dos

- [ ] Create agent event constants file (apps/telemetry/src/events/agent.events.ts) and export from index.ts
- [ ] Add TelemetryManager to FactoryAgentOptions and FactoryAgent class, make it optional for backward compatibility
- [ ] Instrument FactoryAgent.respond() with conversation span and message span
- [ ] Pass telemetry to state machine and instrument XState actor invocations
- [ ] Instrument LLM calls in model providers (webllm, azure, ollama) with spans and token usage
- [ ] Update CLI integration to pass telemetry to FactoryAgent in interactive-repl.ts and notebook-runner.ts
- [ ] Test span hierarchy, token metrics, and backward compatibility