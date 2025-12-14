'use client';

import { useEffect, useRef, memo, useMemo } from 'react';
import { MessageResponse } from '../../ai-elements/message';
import type { UIMessage } from 'ai';
import type { useChat } from '@ai-sdk/react';
import { cn } from '../../lib/utils';
import { isSuggestionPattern, extractSuggestionText, validateSuggestionElement } from './utils/suggestion-pattern';
import { getContextMessages } from './utils/message-context';
import {
  cleanSuggestionPatterns,
  createSuggestionButton,
  generateSuggestionId,
  scrollToConversationBottom,
  STREAMDOWN_RENDER_DELAY,
} from './utils/suggestion-enhancement';

export interface StreamdownWithSuggestionsProps {
  children: string;
  className?: string;
  sendMessage?: ReturnType<typeof useChat>['sendMessage'];
  messages?: UIMessage[];
  currentMessageId?: string;
}

export const StreamdownWithSuggestions = memo(
  ({
    className,
    children,
    sendMessage,
    messages,
    currentMessageId,
  }: StreamdownWithSuggestionsProps) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const contextMessages = useMemo(
      () => getContextMessages(messages, currentMessageId),
      [messages, currentMessageId],
    );

    useEffect(() => {
      if (!containerRef.current || !sendMessage) return;

      const timeoutId = setTimeout(() => {
        try {
          const container = containerRef.current;
          if (!container) return;

          const allElements = Array.from(container.querySelectorAll('li, p'));
          const cleanupFunctions: Array<() => void> = [];
          const elementsWithSuggestions = new Map<Element, string>();

          allElements.forEach((element) => {
            if (element.querySelector('[data-suggestion-button]')) {
              return;
            }

            const elementText = element.textContent || '';
            
            if (isSuggestionPattern(elementText)) {
              const suggestionText = extractSuggestionText(elementText);
              if (suggestionText && suggestionText.length > 0 && validateSuggestionElement(element, elementText)) {
                elementsWithSuggestions.set(element, suggestionText);
              }
            }
          });

          cleanSuggestionPatterns(container);

          elementsWithSuggestions.forEach((suggestionText, element) => {
            if (element.querySelector('[data-suggestion-button]')) {
              return;
            }

            const suggestionId = generateSuggestionId(suggestionText);
            
            const { cleanup } = createSuggestionButton(element, {
              suggestionText,
              suggestionId,
              handlers: {
                onClick: (cleanSuggestionText, sourceSuggestionId) => {
                  let messageText = cleanSuggestionText;
                  const { lastUserQuestion, lastAssistantResponse } = contextMessages;
                  
                  if (lastUserQuestion || lastAssistantResponse || sourceSuggestionId) {
                    const contextData = JSON.stringify({
                      lastUserQuestion,
                      lastAssistantResponse,
                      sourceSuggestionId,
                    });
                    messageText = `__QWERY_CONTEXT__${contextData}__QWERY_CONTEXT_END__${cleanSuggestionText}`;
                  }
                  
                  sendMessage({ text: messageText }, {});
                  scrollToConversationBottom();
                },
              },
            });
            
            cleanupFunctions.push(cleanup);
          });

          return () => {
            cleanupFunctions.forEach((cleanup) => cleanup());
          };
        } catch (error) {
          console.error('[StreamdownWithSuggestions] Error processing suggestions:', error);
        }
      }, STREAMDOWN_RENDER_DELAY);

      return () => {
        clearTimeout(timeoutId);
      };
    }, [children, sendMessage, contextMessages]);

    return (
      <div ref={containerRef} className={cn('min-w-0 max-w-full overflow-hidden', className)} style={{ maxWidth: '100%', overflowX: 'hidden' }}>
        <MessageResponse>{children}</MessageResponse>
      </div>
    );
  },
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.sendMessage === nextProps.sendMessage &&
    prevProps.messages === nextProps.messages &&
    prevProps.currentMessageId === nextProps.currentMessageId,
);

StreamdownWithSuggestions.displayName = 'StreamdownWithSuggestions';

