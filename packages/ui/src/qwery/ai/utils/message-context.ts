import type { UIMessage, ToolUIPart } from 'ai';
import { parseMessageWithContext } from '../user-message-bubble';

const CONTEXT_MARKER = '__QWERY_CONTEXT__';
const CONTEXT_END_MARKER = '__QWERY_CONTEXT_END__';

export function cleanContextMarkers(text: string): string {
  let cleaned = text;
  let previousCleaned = '';
  while (cleaned !== previousCleaned) {
    previousCleaned = cleaned;
    cleaned = cleaned.replace(
      new RegExp(
        CONTEXT_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
          '.*?' +
          CONTEXT_END_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'gs',
      ),
      '',
    );
  }
  cleaned = cleaned.replace(/__QWERY_SUGGESTION_GUIDANCE__/g, '');
  cleaned = cleaned.replace(/__QWERY_SUGGESTION_GUIDANCE_END__/g, '');
  return cleaned;
}

export function getToolStatusLabel(state: string | undefined): string {
  const statusMap: Record<string, string> = {
    'input-streaming': 'Pending',
    'input-available': 'Processing',
    'approval-requested': 'Awaiting Approval',
    'approval-responded': 'Responded',
    'output-available': 'Completed',
    'output-error': 'Error',
    'output-denied': 'Denied',
  };
  return statusMap[state ?? ''] ?? state ?? 'Unknown';
}

export function formatToolCalls(parts: UIMessage['parts']): string {
  const toolCalls: string[] = [];
  const textParts: string[] = [];

  for (const part of parts) {
    if (part.type === 'text' && 'text' in part && part.text.trim()) {
      textParts.push(part.text.trim());
    } else if (part.type.startsWith('tool-')) {
      const toolName = part.type.replace('tool-', '');
      const formattedName = toolName
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/^./, (str) => str.toUpperCase())
        .replace(/\s+/g, ' ')
        .trim();
      
      const toolPart = part as ToolUIPart;
      const status = toolPart.state ? getToolStatusLabel(toolPart.state) : null;
      
      if (status) {
        toolCalls.push(`**${formattedName}** called (${status})`);
      } else {
        toolCalls.push(`**${formattedName}** called`);
      }
    }
  }

  const result: string[] = [];
  if (toolCalls.length > 0) {
    if (toolCalls.length === 1 && toolCalls[0]) {
      result.push(toolCalls[0]);
    } else {
      result.push(toolCalls.map((tc) => `- ${tc}`).join('\n'));
    }
  }
  
  if (textParts.length > 0) {
    const textContent = textParts.join('\n\n').trim();
    if (textContent) {
      result.push(textContent);
    }
  }

  return result.join('\n\n');
}

export function getContextMessages(
  messages: UIMessage[] | undefined,
  currentMessageId: string | undefined,
): { lastUserQuestion?: string; lastAssistantResponse?: string } {
  if (!messages || !currentMessageId) {
    return {};
  }

  const currentIndex = messages.findIndex((m) => m.id === currentMessageId);
  if (currentIndex === -1) {
    return {};
  }

  const currentMessage = messages[currentIndex];
  
  let lastUserQuestion: string | undefined;
  for (let i = currentIndex - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.role === 'user') {
      const textPart = msg.parts.find((p) => p.type === 'text');
      if (textPart && 'text' in textPart && textPart.text) {
        const parsed = parseMessageWithContext(textPart.text);
        lastUserQuestion = parsed.text || cleanContextMarkers(textPart.text);
        break;
      }
    }
  }

  let lastAssistantResponse: string | undefined;
  if (currentMessage?.role === 'assistant') {
    const formatted = formatToolCalls(currentMessage.parts);
    if (formatted.trim()) {
      lastAssistantResponse = cleanContextMarkers(formatted);
    }
  }

  return { lastUserQuestion, lastAssistantResponse };
}

