'use client';

import { Fragment, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';

import { Bubble, BubbleContent } from '@/components/ui/bubble';
import {
  Message,
  MessageContent,
  MessageHeader,
} from '@/components/ui/message';
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  useMessageScroller,
} from '@/components/ui/message-scroller';

import type { VoiceState } from '@/components/status';
import { formatAssistantTranscript } from '@/lib/conversation';
import { cn } from '@/lib/utils';

export interface TranscriptMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  createdAt?: number;
  streaming?: boolean;
}
export interface ConversationPanelProps {
  id: string;
  name?: string;
  messages: TranscriptMessage[];
  pending: boolean;

  voiceState?: VoiceState;
  hidden?: boolean;
  className?: string;
  attachments?: TranscriptAttachment[];
}

export interface TranscriptAttachment {
  id: string;
  afterMessageId?: string;
  content: ReactNode;
}

const emptyTranscriptCopy: Partial<Record<VoiceState, string>> = {
  connecting: 'Connecting…',
  ended: 'No transcript was recorded.',
  error: 'Transcript unavailable.',
};

function TranscriptScrollRestoration({
  hidden,
  messages,
  following,
}: {
  hidden?: boolean;
  messages: TranscriptMessage[];
  following: RefObject<boolean>;
}) {
  const { scrollToEnd } = useMessageScroller();

  useLayoutEffect(() => {
    if (!hidden && following.current) {
      scrollToEnd({ behavior: 'auto' });
    }
  }, [hidden, messages, following, scrollToEnd]);

  return null;
}

export function ConversationPanel({
  id,
  name = 'Assistant',
  messages,
  pending,
  voiceState = 'ready',
  hidden,
  className,
  attachments = [],
}: ConversationPanelProps) {
  // Layout changes may move scrollTop; only user input should pause following.
  const following = useRef(true);
  const userScrolling = useRef(false);
  const unanchored = attachments.filter(attachment =>
    !messages.some(message => message.id === attachment.afterMessageId),
  );
  return (
    <section
      id={id}
      hidden={hidden}
      className={cn('ag-conversation', className)}
      aria-label={`Conversation with ${name}`}
      aria-busy={pending}
      data-voice-state={voiceState}
    >
      <div className="ag-transcript">
        <MessageScrollerProvider autoScroll defaultScrollPosition="end">
          <TranscriptScrollRestoration hidden={hidden} messages={messages} following={following} />
          <MessageScroller>
            <MessageScrollerViewport
              role="log"
              aria-label={`${name} live transcript`}
              aria-live="polite"
              tabIndex={0}
              onWheelCapture={(event) => {
                userScrolling.current = true;
                if (event.deltaY < 0) following.current = false;
              }}
              onTouchMoveCapture={() => { userScrolling.current = true; }}
              onPointerDownCapture={() => { userScrolling.current = true; }}
              onKeyDownCapture={(event) => {
                if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) {
                  userScrolling.current = true;
                  if (['ArrowUp', 'PageUp', 'Home'].includes(event.key) || (event.key === ' ' && event.shiftKey)) following.current = false;
                }
              }}
              onScroll={(event) => {
                const viewport = event.currentTarget;
                if (!viewport.clientHeight) return;
                const atEnd = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 8;
                if (atEnd) {
                  following.current = true;
                  userScrolling.current = false;
                } else if (userScrolling.current) {
                  following.current = false;
                }
              }}
            >
              <MessageScrollerContent>
                {messages.length === 0 && attachments.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    {emptyTranscriptCopy[voiceState] ?? 'The transcript will appear here.'}
                  </p>
                ) : null}
                {messages.map((message) => (
                  <Fragment key={message.id}>
                    <MessageScrollerItem messageId={message.id}>
                      <Message
                        align={message.role === 'user' ? 'end' : 'start'}
                      >
                        <MessageContent>
                          <MessageHeader>
                            {message.role === 'user' ? 'You' : 'Assistant'}
                            {message.createdAt && (
                              <time
                                className="ml-2 font-normal"
                                dateTime={new Date(
                                  message.createdAt,
                                ).toISOString()}
                              >
                                {new Intl.DateTimeFormat('en', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                }).format(new Date(message.createdAt))}
                              </time>
                            )}
                            {message.streaming && (
                              <span className="ml-2 font-normal">Live</span>
                            )}
                          </MessageHeader>
                          <Bubble
                            variant={
                              message.role === 'user' ? 'tinted' : 'ghost'
                            }
                            align={message.role === 'user' ? 'end' : 'start'}
                          >
                            <BubbleContent>
                              {message.role === 'agent' ? formatAssistantTranscript(message.text) : message.text}
                            </BubbleContent>
                          </Bubble>
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                    {attachments.filter(attachment => attachment.afterMessageId === message.id).map(attachment => (
                      <MessageScrollerItem key={attachment.id} messageId={attachment.id}>
                        {attachment.content}
                      </MessageScrollerItem>
                    ))}
                  </Fragment>
                ))}
                {unanchored.map(attachment => (
                  <MessageScrollerItem key={attachment.id} messageId={attachment.id}>
                    {attachment.content}
                  </MessageScrollerItem>
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton behavior="auto" onClick={() => {
              following.current = true;
              userScrolling.current = false;
            }} />
          </MessageScroller>
        </MessageScrollerProvider>
      </div>
    </section>
  );
}
