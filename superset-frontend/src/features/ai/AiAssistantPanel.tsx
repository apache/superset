/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * @fileoverview The assistant panel.
 *
 * The host owns where this sits and, when docked, how wide it is, so there is no
 * positioning and no resize handle here. What is here is the conversation: the
 * header, the transcript, what the assistant is doing while it works, and the
 * composer.
 *
 * The centre of the design is that a run is legible while it happens. An answer
 * can take a minute of tool calls, and a spinner for a minute is indistinguishable
 * from a hang, so reasoning streams into a preview, each step appends to a tool
 * log, and a checkpoint stops the run with a countdown the user can act on.
 */

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { Dispatch, SetStateAction } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { css, keyframes, styled, useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import type { chat as chatApi } from '@apache-superset/core';
import {
  Button,
  Input,
  Loading,
  Tooltip,
  Typography,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { chat } from 'src/core/chat';
import ChatAgentSelect from './components/ChatAgentSelect';
import ChatTabsMenu from './components/ChatTabsMenu';
import { REMARK_PLUGINS, useChatMarkdown } from './components/chatMarkdown';
import { ThoughtProcess } from './components/ThoughtProcess';
import { useChatBot } from './hooks/useChatBot';
import { AI_ACTION_EVENT, type AiActionEvent } from './hooks/useAIAction';
import type { PageContext } from './hooks/usePageContext';
import type { ChatMessageWithMeta, CheckpointPayload } from './types';

/**
 * How long a checkpoint waits before continuing on its own. A pause that blocks
 * forever is worse than one that resolves optimistically: the user may have
 * walked away, and the run should not be stranded.
 */
export const CHECKPOINT_TIMEOUT_SECONDS = 30;

/**
 * Closes a code fence the model has not finished writing.
 *
 * A streamed answer is parsed on every delta, so a fence arrives in pieces —
 * "```", then "sql", then the query. Markdown with an odd number of fences
 * renders the opening backticks literally and then reflows once the closing pair
 * lands, which reads as the answer glitching. Balancing the count keeps each
 * intermediate state a valid document.
 */
export const balanceCodeFences = (text: string): string => {
  const fences = text.match(/^```/gm)?.length ?? 0;
  return fences % 2 === 0 ? text : `${text}\n\`\`\``;
};

/**
 * Whether a message carries the structured record of how it was answered, as
 * opposed to only the flat log assembled from stream frames.
 */
const hasStructuredThinking = (message: ChatMessageWithMeta): boolean =>
  Boolean(message.toolCalls?.length || message.thoughts || message.pageContext);

/** Milliseconds between typewriter frames, and characters per frame. */
const TYPEWRITER_INTERVAL_MS = 18;
const TYPEWRITER_STEP = 3;

/**
 * The panel's own size as a floating overlay.
 *
 * Docked width belongs to the host and is not set here. Floating does need a size
 * from somewhere, though — the floating host only stacks its children in a corner
 * and gives them no dimensions — so these clamp the overlay to the viewport.
 */
const FLOATING_WIDTH_PX = 440;
const FLOATING_MAX_HEIGHT_VH = 70;

/**
 * The panel surface.
 *
 * Positioning is deliberately absent: the host places this, in both modes. What is
 * here is the surface itself — a column that fills whatever box it is given, with a
 * floating size for the mode where the host provides no box.
 */
const ChatPanelContainer = styled.div<{ floating: boolean }>`
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: ${({ theme }) => theme.colorBgElevated};
  ${({ floating, theme }) =>
    floating
      ? css`
          width: min(
            ${FLOATING_WIDTH_PX}px,
            calc(100vw - ${theme.sizeUnit * 12}px)
          );
          height: ${FLOATING_MAX_HEIGHT_VH}vh;
          border: 1px solid ${theme.colorBorderSecondary};
          border-radius: ${theme.borderRadiusLG}px;
          box-shadow: ${theme.boxShadow};
        `
      : css`
          width: 100%;
          height: 100%;
        `}
`;

const ChatHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${({ theme }) => theme.sizeUnit * 3}px
    ${({ theme }) => theme.sizeUnit * 4}px;
  background: ${({ theme }) => theme.colorBgContainer};
  border-bottom: 1px solid ${({ theme }) => theme.colorBorderSecondary};
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  font-size: ${({ theme }) => theme.fontSizeLG}px;
  color: ${({ theme }) => theme.colorTextHeading};
  flex-shrink: 0;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const HeaderGroup = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;
`;

const HeaderTitle = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ChatMessages = styled.div`
  flex: 1;
  min-height: 0;
  padding: ${({ theme }) => theme.sizeUnit * 4}px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colorBgContainer};
    border-radius: 2px;
  }

  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colorFillSecondary};
    border-radius: 2px;
  }
`;

const MessageBubble = styled.div<{ variant: 'user' | 'assistant' }>`
  margin-bottom: ${({ theme }) => theme.sizeUnit * 3}px;
  display: flex;
  flex-direction: column;
  align-items: ${({ variant }) =>
    variant === 'user' ? 'flex-end' : 'flex-start'};
`;

const MessageContent = styled.div<{ variant: 'user' | 'assistant' }>`
  max-width: 85%;
  padding: ${({ theme }) => theme.sizeUnit * 3}px
    ${({ theme }) => theme.sizeUnit * 4}px;
  border-radius: ${({ theme }) => theme.borderRadiusLG * 2}px;
  background: ${({ theme, variant }) =>
    variant === 'user' ? theme.colorPrimary : theme.colorBgContainer};
  color: ${({ theme, variant }) =>
    variant === 'user' ? theme.colorTextLightSolid : theme.colorText};
  font-size: ${({ theme }) => theme.fontSize}px;
  line-height: 1.5;
  border: ${({ theme, variant }) =>
    variant === 'assistant'
      ? `1px solid ${theme.colorBorderSecondary}`
      : 'none'};
  box-shadow: ${({ theme }) => theme.boxShadowTertiary};
  overflow-wrap: anywhere;

  p {
    margin: 0;
  }

  p:not(:last-child) {
    margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
  }

  a {
    color: ${({ theme, variant }) =>
      variant === 'user' ? theme.colorTextLightSolid : theme.colorPrimary};
    text-decoration: underline;
  }

  code {
    background: ${({ theme, variant }) =>
      variant === 'user' ? theme.colorPrimaryActive : theme.colorFillTertiary};
    padding: 2px ${({ theme }) => theme.sizeUnit * 1.5}px;
    border-radius: ${({ theme }) => theme.borderRadius}px;
    font-size: ${({ theme }) => theme.fontSizeSM}px;
    font-family: ${({ theme }) => theme.fontFamilyCode};
  }

  pre {
    background: ${({ theme }) => theme.colorFillQuaternary};
    padding: ${({ theme }) => theme.sizeUnit * 3}px;
    border-radius: ${({ theme }) => theme.borderRadius}px;
    overflow-x: auto;
    margin: ${({ theme }) => theme.sizeUnit * 2}px 0;
    border: 1px solid ${({ theme }) => theme.colorBorderSecondary};
  }

  pre code {
    background: none;
    padding: 0;
  }
`;

const MessageActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.sizeUnit}px;
  margin-top: ${({ theme }) => theme.sizeUnit}px;
`;

const ActionButton = styled(Button)`
  &&& {
    padding: 2px ${({ theme }) => theme.sizeUnit * 1.5}px;
    height: ${({ theme }) => theme.sizeUnit * 6}px;
    font-size: ${({ theme }) => theme.fontSizeSM}px;
  }

  /* The recorded verdict keeps its colour while disabled. Both thumbs lock once
     a rating exists, and the default disabled grey would hide which one the
     user picked — the state matters more here than the affordance. */
  &&&.is-active,
  &&&.is-active:disabled,
  &&&.is-active[disabled] {
    color: ${({ theme }) => theme.colorPrimary};
  }
`;

const LiveAnswer = styled.div`
  margin-top: ${({ theme }) => theme.sizeUnit * 2}px;
  color: ${({ theme }) => theme.colorText};
  font-size: ${({ theme }) => theme.fontSize}px;
  line-height: 1.5;
  overflow-wrap: anywhere;

  p {
    margin: 0;
  }

  p:not(:last-child) {
    margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
  }
`;

const thinkingPulse = keyframes`
  0% {
    opacity: 0.45;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.45;
  }
`;

const ThinkingPreview = styled.div<{ isLive?: boolean }>`
  color: ${({ theme }) => theme.colorTextTertiary};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  white-space: pre-wrap;
  ${({ isLive }) =>
    isLive &&
    css`
      animation: ${thinkingPulse} 1.8s ease-in-out infinite;
    `}
`;

const ThinkingDetails = styled.details`
  margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
  color: ${({ theme }) => theme.colorTextTertiary};
  font-size: ${({ theme }) => theme.fontSizeSM}px;

  summary {
    cursor: pointer;
    user-select: none;
    color: ${({ theme }) => theme.colorTextTertiary};
    margin-bottom: ${({ theme }) => theme.sizeUnit}px;
  }
`;

const CheckpointDivider = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit * 3}px;
  margin: ${({ theme }) => theme.sizeUnit * 4}px 0
    ${({ theme }) => theme.sizeUnit * 3}px;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: ${({ theme }) => theme.colorBorderSecondary};
  }
`;

const CountdownBadge = styled.span`
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colorTextSecondary};
  white-space: nowrap;
`;

const CheckpointContent = styled.div`
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  color: ${({ theme }) => theme.colorText};
  line-height: 1.5;
`;

const CheckpointTaskList = styled.ul`
  margin: ${({ theme }) => theme.sizeUnit * 1.5}px 0;
  padding-left: ${({ theme }) => theme.sizeUnit * 4.5}px;
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  color: ${({ theme }) => theme.colorTextSecondary};

  li {
    margin-bottom: 2px;
  }
`;

const CheckpointEstimate = styled.div`
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  color: ${({ theme }) => theme.colorTextTertiary};
  margin-top: ${({ theme }) => theme.sizeUnit}px;
`;

const CheckpointActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  margin-top: ${({ theme }) => theme.sizeUnit * 2.5}px;
`;

const ChatInput = styled.div`
  padding: ${({ theme }) => theme.sizeUnit * 4}px;
  border-top: 1px solid ${({ theme }) => theme.colorBorderSecondary};
  background: ${({ theme }) => theme.colorBgContainer};
  flex-shrink: 0;
`;

const InputContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  align-items: flex-end;
`;

const QuickPromptsRow = styled.div<{ hasContent: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  flex-wrap: wrap;
  margin-bottom: ${({ theme, hasContent }) =>
    hasContent ? `${theme.sizeUnit * 2.5}px` : '0'};
  min-height: ${({ theme, hasContent }) =>
    hasContent ? `${theme.sizeUnit * 6}px` : '0'};
`;

const QuickPromptChip = styled(Button)`
  &&& {
    width: fit-content;
    max-width: 100%;
    height: auto;
    white-space: normal;
    text-align: left;
    line-height: 1.35;
    word-break: break-word;
  }
`;

const PageContextRow = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.sizeUnit * 1.5}px;
`;

const PageContextPill = styled.button<{ isActive: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit * 1.5}px;
  padding: 3px ${({ theme }) => theme.sizeUnit * 2}px;
  border-radius: ${({ theme }) => theme.borderRadiusLG}px;
  border: 1px solid
    ${({ theme, isActive }) =>
      isActive ? theme.colorPrimary : theme.colorBorderSecondary};
  background: ${({ theme, isActive }) =>
    isActive ? theme.colorPrimaryBg : theme.colorFillQuaternary};
  color: ${({ theme, isActive }) =>
    isActive ? theme.colorPrimary : theme.colorTextTertiary};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  cursor: pointer;
  transition: all ${({ theme }) => theme.motionDurationMid};
  max-width: ${({ theme }) => theme.sizeUnit * 62}px;
  white-space: nowrap;

  &:hover {
    border-color: ${({ theme }) => theme.colorPrimary};
  }
`;

const PillLabel = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PillDot = styled.span<{ isActive: boolean }>`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${({ theme, isActive }) =>
    isActive ? theme.colorPrimary : theme.colorTextQuaternary};
  transition: background ${({ theme }) => theme.motionDurationMid};
`;

const EmptyState = styled.div`
  text-align: center;
  color: ${({ theme }) => theme.colorTextSecondary};
  font-size: ${({ theme }) => theme.fontSizeLG}px;
  margin-top: ${({ theme }) => theme.sizeUnit * 15}px;
  padding: 0 ${({ theme }) => theme.sizeUnit * 10}px;
  line-height: 1.5;
`;

/**
 * What the page-context pill says it is sending.
 *
 * Naming the specific chart or dashboard is the whole point: "page context" tells
 * the user nothing about whether the assistant can see the thing they are asking
 * about.
 */
export const getPageContextLabel = (context: PageContext): string => {
  switch (context.pageType) {
    case 'sqllab':
      return context.sqlContext?.activeEditor?.name || t('SQL Lab');
    case 'dashboard':
      return context.dashboardContext?.title
        ? t('Dashboard: %s', context.dashboardContext.title)
        : t('Dashboard');
    case 'explore':
    case 'chart': {
      const name =
        context.chartContext?.chartName ||
        context.chartContext?.slice?.slice_name;
      return name ? t('Chart: %s', name) : t('Chart Explorer');
    }
    case 'home':
      return t('Home');
    default:
      return context.pathname;
  }
};

interface MemoizedChatMessageProps {
  message: ChatMessageWithMeta;
  feedback: 'like' | 'dislike' | null;
  /** Per-message SQL expansion state, present only to invalidate the memo. */
  sqlBlockExpandState: boolean[] | undefined;
  createMarkdownComponents: (messageId: string) => Components;
  /** Keeps this message's thought process open, for the run that just ended. */
  keepThinkingOpen?: boolean;
  onFeedback: (messageId: string, feedback: 'like' | 'dislike') => void;
  onCopy: (content: string) => Promise<void>;
}

/**
 * One turn.
 *
 * Memoized on content rather than identity because a streaming run re-renders the
 * panel on every frame, and re-parsing the markdown of every earlier message each
 * time made long conversations visibly janky.
 */
const MemoizedChatMessage = memo(
  ({
    message,
    feedback,
    createMarkdownComponents,
    keepThinkingOpen,
    onFeedback,
    onCopy,
  }: MemoizedChatMessageProps) => {
    const markdownComponents = createMarkdownComponents(message.id);
    return (
      <MessageBubble
        variant={message.role}
        data-test="chat-message"
        data-role={message.role}
      >
        <MessageContent variant={message.role}>
          {message.role === 'assistant' &&
            // Steps are rendered structurally where the server has sent them,
            // and as the flat log otherwise. The two are not alternatives so
            // much as two stages: a turn assembled from stream frames only has
            // the text, and gains its structure when the transcript is re-read
            // from the server once the run ends. Any one of the structured
            // fields is enough — a turn can have page context and no tool calls,
            // or reasoning and no steps.
            (hasStructuredThinking(message) ? (
              <ThoughtProcess
                reasoning={message.thoughts}
                pageContext={message.pageContext}
                toolCalls={message.toolCalls}
                markdownComponents={markdownComponents}
                // Left open for the turn that has only just finished, so the
                // section does not collapse and pull the answer up the panel the
                // moment the user starts reading it.
                defaultOpen={keepThinkingOpen}
              />
            ) : (
              message.thinking && (
                <ThinkingDetails>
                  <summary>{t('Thought process')}</summary>
                  {/* The tool log is markdown too, so a SQL step gets the same
                      highlighting and "Run in SQL Lab" as SQL in the answer. */}
                  <ReactMarkdown
                    components={markdownComponents}
                    remarkPlugins={REMARK_PLUGINS}
                  >
                    {message.thinking}
                  </ReactMarkdown>
                </ThinkingDetails>
              )
            ))}
          <ReactMarkdown
            components={markdownComponents}
            remarkPlugins={REMARK_PLUGINS}
          >
            {message.content}
          </ReactMarkdown>
        </MessageContent>
        {message.role === 'assistant' && (
          <MessageActions>
            {/* Both thumbs stay available so a mis-click can be corrected. The
                recorded verdict is the coloured one, and only it is inert —
                there is no endpoint to withdraw a rating, so pressing it again
                would do nothing and should not look like it could. */}
            <ActionButton
              buttonStyle="link"
              icon={<Icons.LikeOutlined iconSize="s" />}
              onClick={() => onFeedback(message.id, 'like')}
              className={feedback === 'like' ? 'is-active' : ''}
              aria-label={t('Good response')}
              aria-pressed={feedback === 'like'}
              tooltip={
                feedback === 'like'
                  ? t('You marked this a good response')
                  : t('Good response')
              }
              disabled={message.pending || feedback === 'like'}
            />
            <ActionButton
              buttonStyle="link"
              icon={<Icons.DislikeOutlined iconSize="s" />}
              onClick={() => onFeedback(message.id, 'dislike')}
              className={feedback === 'dislike' ? 'is-active' : ''}
              aria-label={t('Bad response')}
              aria-pressed={feedback === 'dislike'}
              tooltip={
                feedback === 'dislike'
                  ? t('You marked this a bad response')
                  : t('Bad response')
              }
              disabled={message.pending || feedback === 'dislike'}
            />
            <ActionButton
              buttonStyle="link"
              icon={<Icons.CopyOutlined iconSize="s" />}
              onClick={() => {
                onCopy(message.content).catch(() => {
                  // Clipboard access can be refused; the button then does
                  // nothing rather than raising at the user.
                });
              }}
              aria-label={t('Copy to clipboard')}
              tooltip={t('Copy to clipboard')}
            />
          </MessageActions>
        )}
      </MessageBubble>
    );
  },
  (previous, next) =>
    previous.message.id === next.message.id &&
    previous.message.content === next.message.content &&
    previous.message.thinking === next.message.thinking &&
    // Compared by identity, not deeply: the server's copy of a message arrives as
    // a fresh array, which is exactly the case that has to re-render, and a deep
    // compare of every step on every streamed frame would cost more than the
    // render it avoids.
    previous.message.toolCalls === next.message.toolCalls &&
    previous.message.thoughts === next.message.thoughts &&
    previous.message.pageContext === next.message.pageContext &&
    previous.message.pending === next.message.pending &&
    previous.feedback === next.feedback &&
    previous.keepThinkingOpen === next.keepThinkingOpen &&
    previous.sqlBlockExpandState === next.sqlBlockExpandState,
);
MemoizedChatMessage.displayName = 'MemoizedChatMessage';

/**
 * A pause the user can act on.
 *
 * The countdown exists so the pause cannot strand the run; continuing on expiry is
 * the same decision the user would most likely have made.
 */
export const CheckpointSection = ({
  checkpoint,
  onContinue,
  onCancel,
}: {
  checkpoint: CheckpointPayload;
  onContinue: () => void;
  onCancel: () => void;
}) => {
  const [secondsLeft, setSecondsLeft] = useState(
    checkpoint.seconds_remaining ?? CHECKPOINT_TIMEOUT_SECONDS,
  );
  // Held in a ref so the interval is installed once; re-installing it on every
  // render would reset the countdown and it would never reach zero.
  const onContinueRef = useRef(onContinue);
  onContinueRef.current = onContinue;

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft(previous => {
        if (previous <= 1) {
          clearInterval(interval);
          onContinueRef.current();
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div data-test="chat-checkpoint">
      <CheckpointDivider>
        <CountdownBadge>{`${minutes}:${seconds
          .toString()
          .padStart(2, '0')}`}</CountdownBadge>
      </CheckpointDivider>
      <CheckpointContent>{checkpoint.summary}</CheckpointContent>
      {checkpoint.remaining_tasks && checkpoint.remaining_tasks.length > 0 && (
        <CheckpointTaskList>
          {checkpoint.remaining_tasks.map(task => (
            <li key={task}>{task}</li>
          ))}
        </CheckpointTaskList>
      )}
      {checkpoint.estimated_duration && (
        <CheckpointEstimate>
          {t('Est. ~%s', checkpoint.estimated_duration)}
        </CheckpointEstimate>
      )}
      <CheckpointActions>
        <Button buttonSize="small" buttonStyle="primary" onClick={onContinue}>
          {t('Continue')}
        </Button>
        <Button buttonSize="small" onClick={onCancel}>
          {t('Cancel')}
        </Button>
      </CheckpointActions>
    </div>
  );
};

/**
 * Reveals text a few characters at a time.
 *
 * Reasoning arrives in bursts, and a preview that jumps a paragraph at a time is
 * hard to read; this smooths it without holding anything back. A target that is
 * not an extension of what is shown (a replacement, not an append) is applied at
 * once, because animating a rewrite would show text that was never sent.
 */
const useTypewriter = (
  target: string,
  setter: Dispatch<SetStateAction<string>>,
  streaming: boolean,
) => {
  useEffect(() => {
    if (!streaming) {
      setter(target);
      return undefined;
    }
    if (!target) {
      setter('');
      return undefined;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      if (cancelled) {
        return;
      }
      setter(previous => {
        if (previous === target) {
          return previous;
        }
        if (!target.startsWith(previous)) {
          return target;
        }
        const remaining = target.length - previous.length;
        const step = Math.min(TYPEWRITER_STEP, Math.max(1, remaining));
        return target.slice(0, previous.length + step);
      });
      timeoutId = setTimeout(tick, TYPEWRITER_INTERVAL_MS);
    };

    timeoutId = setTimeout(tick, TYPEWRITER_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [target, streaming, setter]);
};

/**
 * Tracks the host's display mode, which the host changes of its own accord, so the
 * panel reads it rather than mirroring it.
 */
const useDisplayMode = (): chatApi.DisplayMode =>
  useSyncExternalStore(
    useCallback((onChange: () => void) => {
      const subscription = chat.onDidChangeDisplayMode(onChange);
      return () => subscription.dispose();
    }, []),
    chat.getDisplayMode,
  );

export const AiAssistantPanel = () => {
  const theme = useTheme();
  const displayMode = useDisplayMode();
  const {
    chatTabs,
    activeTabId,
    activeTab,
    threadsLoaded,
    handleNewChat,
    handleSelectTab,
    handleDeleteTab,
    handleRenameTab,
    messages,
    inputValue,
    setInputValue,
    handleKeyDown,
    inputRef,
    messagesEndRef,
    isLoading,
    isStreamingResponse,
    liveThoughts,
    liveToolCalls,
    livePageContext,
    liveAnswer,
    checkpoint,
    activeRunStatus,
    error,
    sendMessage,
    handleCancelRun,
    handleCheckpointContinue,
    handleFeedback,
    messageFeedback,
    justCompletedId,
    quickPrompts,
    loadQuickPrompts,
    applyQuickPrompt,
    agents,
    selectedAgent,
    setSelectedAgent,
    pageContext,
    includePageContext,
    toggleIncludePageContext,
  } = useChatBot();

  const {
    createMarkdownComponents,
    copyToClipboard,
    expandedSqlBlocksByMessage,
  } = useChatMarkdown();

  // The live step list is not attached to a stored message, so it gets its own
  // set of markdown components under a stable synthetic id — that id is what
  // keys the per-message SQL expand state.
  const liveMarkdownComponents = createMarkdownComponents('live-run');

  const [typedThoughts, setTypedThoughts] = useState('');
  useTypewriter(liveThoughts, setTypedThoughts, isStreamingResponse);

  /**
   * A prompt queued for a conversation that does not exist yet.
   *
   * An AI action opens a fresh conversation and sends into it, and the send has to
   * wait for that conversation to become the active one — otherwise it lands in
   * whichever was open before.
   */
  const [pendingSend, setPendingSend] = useState<{
    tabId: string;
    prompt: string;
    systemPrompt?: string;
  } | null>(null);

  useEffect(() => {
    const handleAiAction = (event: Event) => {
      const { detail } = event as AiActionEvent;
      const prompt = detail?.prompt?.trim();
      if (!prompt) {
        return;
      }
      chat.open();
      handleNewChat().then(newTabId => {
        setPendingSend({
          tabId: newTabId,
          prompt,
          systemPrompt: detail.systemPrompt?.trim() || undefined,
        });
      });
    };
    window.addEventListener(AI_ACTION_EVENT, handleAiAction);
    return () => {
      window.removeEventListener(AI_ACTION_EVENT, handleAiAction);
    };
  }, [handleNewChat]);

  useEffect(() => {
    if (!pendingSend || activeTabId !== pendingSend.tabId) {
      return;
    }
    if (!chatTabs.some(tab => tab.id === pendingSend.tabId)) {
      return;
    }
    const { prompt, systemPrompt } = pendingSend;
    setPendingSend(null);
    sendMessage(prompt, systemPrompt);
  }, [pendingSend, activeTabId, chatTabs, sendMessage]);

  const onSelectTab = useCallback(
    (tabId: string) => {
      handleSelectTab(tabId);
    },
    [handleSelectTab],
  );

  // The row collapses to nothing when there is nothing to suggest, rather than
  // holding empty space above the composer.
  const hasQuickPromptContent = quickPrompts.length > 0;

  return (
    <ChatPanelContainer
      floating={displayMode !== 'panel'}
      data-test="ai-assistant-panel"
    >
      <ChatHeader>
        <HeaderGroup>
          <ChatTabsMenu
            tabs={chatTabs}
            activeTabId={activeTabId}
            onSelectTab={onSelectTab}
            onNewChat={() => {
              handleNewChat();
            }}
            onDeleteTab={tabId => {
              handleDeleteTab(tabId);
            }}
            onRenameTab={handleRenameTab}
          />
          <HeaderTitle>{activeTab?.name || t('AI assistant')}</HeaderTitle>
        </HeaderGroup>
        <HeaderGroup>
          {agents.length > 1 && (
            <ChatAgentSelect
              agents={agents}
              selectedAgent={selectedAgent}
              onChange={setSelectedAgent}
            />
          )}
          {/* Docking is the host's, not ours: it decides where the panel goes, so
              this only asks it to change mode. */}
          <Button
            buttonStyle="link"
            icon={
              displayMode === 'panel' ? (
                <Icons.CompressOutlined iconSize="m" />
              ) : (
                <Icons.ExpandOutlined iconSize="m" />
              )
            }
            onClick={() =>
              chat.setDisplayMode(
                displayMode === 'panel' ? 'floating' : 'panel',
              )
            }
            aria-label={
              displayMode === 'panel'
                ? t('Undock the assistant')
                : t('Dock the assistant')
            }
            tooltip={
              displayMode === 'panel'
                ? t('Undock the assistant')
                : t('Dock the assistant')
            }
          />
          <Button
            buttonStyle="link"
            icon={<Icons.CloseOutlined iconSize="m" />}
            onClick={() => chat.close()}
            aria-label={t('Close the assistant')}
          />
        </HeaderGroup>
      </ChatHeader>

      <ChatMessages data-test="chat-messages">
        {messages.length === 0 ? (
          <EmptyState>
            {threadsLoaded
              ? t('Ask a question about what you are looking at.')
              : t('Loading your conversations...')}
          </EmptyState>
        ) : (
          messages.map(message => (
            <MemoizedChatMessage
              key={message.id}
              message={message}
              feedback={messageFeedback[message.id] ?? null}
              sqlBlockExpandState={expandedSqlBlocksByMessage[message.id]}
              createMarkdownComponents={createMarkdownComponents}
              keepThinkingOpen={message.id === justCompletedId}
              onFeedback={handleFeedback}
              onCopy={copyToClipboard}
            />
          ))
        )}

        {isLoading && (
          <MessageBubble variant="assistant" data-test="chat-activity">
            <MessageContent variant="assistant">
              {isStreamingResponse ? (
                <>
                  <ThinkingPreview isLive={!checkpoint}>
                    {typedThoughts || t('Starting analysis...')}
                  </ThinkingPreview>
                  {/* Steps that have completed are shown structurally as they
                      arrive, so a query the assistant ran mid-run can be opened
                      and read straight away rather than only after the run ends
                      and the transcript is re-read. The typewriter line above
                      still reports what it is doing right now. */}
                  {(liveToolCalls.length > 0 || livePageContext) && (
                    <>
                      <hr
                        css={css`
                          border: none;
                          border-top: 1px solid ${theme.colorBorderSecondary};
                          margin: ${theme.sizeUnit * 2}px 0;
                        `}
                      />
                      <ThoughtProcess
                        pageContext={livePageContext}
                        toolCalls={liveToolCalls}
                        markdownComponents={liveMarkdownComponents}
                        // Open while the run is in flight: the steps are the
                        // point of watching it. Each step's own detail stays
                        // closed, so what is on screen is a clean list of what
                        // it is doing rather than a wall of results.
                        defaultOpen
                        typewriter
                      />
                    </>
                  )}
                  {/* The answer as it is generated. Rendered as markdown so a
                      partially-arrived table or code fence looks like what it
                      will become, and replaced by the stored message once the
                      run ends — the `final` frame is authoritative. */}
                  {liveAnswer && (
                    <LiveAnswer data-test="chat-live-answer">
                      {/* Rendered without the transcript's own components on
                          purpose. Those turn a SQL block into a widget with a
                          "Run in SQL Lab" button, and mid-stream that button
                          would appear over a half-written query and re-render on
                          every delta. The finished message gets the full
                          treatment a moment later. */}
                      <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>
                        {balanceCodeFences(liveAnswer)}
                      </ReactMarkdown>
                    </LiveAnswer>
                  )}
                  {checkpoint && (
                    <CheckpointSection
                      checkpoint={checkpoint}
                      onContinue={handleCheckpointContinue}
                      onCancel={() => {
                        handleCancelRun();
                      }}
                    />
                  )}
                </>
              ) : (
                <ThinkingPreview isLive>
                  <Loading position="inline-centered" size="s" />
                  {t('Thinking...')}
                </ThinkingPreview>
              )}
            </MessageContent>
          </MessageBubble>
        )}

        <div ref={messagesEndRef} />
      </ChatMessages>

      <ChatInput>
        <QuickPromptsRow hasContent={hasQuickPromptContent}>
          {quickPrompts.map(prompt => (
            <Tooltip key={prompt} title={prompt}>
              <QuickPromptChip
                buttonSize="small"
                onClick={() => {
                  applyQuickPrompt(prompt);
                }}
                aria-label={prompt}
              >
                {prompt}
              </QuickPromptChip>
            </Tooltip>
          ))}
        </QuickPromptsRow>
        {error && (
          <Typography.Text type="danger" data-test="chat-error">
            {error}
          </Typography.Text>
        )}
        <PageContextRow>
          <Tooltip
            title={
              includePageContext
                ? t(
                    'Page context is included in your messages. Click to disable.',
                  )
                : t('Page context is not included. Click to enable.')
            }
          >
            <PageContextPill
              type="button"
              isActive={includePageContext}
              onClick={toggleIncludePageContext}
              aria-pressed={includePageContext}
              data-test="chat-page-context-pill"
            >
              <PillDot isActive={includePageContext} />
              <PillLabel>{getPageContextLabel(pageContext)}</PillLabel>
            </PageContextPill>
          </Tooltip>
        </PageContextRow>
        <InputContainer>
          <Input.TextArea
            ref={inputRef}
            value={inputValue}
            onChange={event => setInputValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('Type your message... (up/down for history)')}
            aria-label={t('Message the assistant')}
            autoSize={{ minRows: 1, maxRows: 4 }}
          />
          <Button
            buttonStyle="secondary"
            icon={<Icons.QuestionCircleOutlined iconSize="m" />}
            onClick={loadQuickPrompts}
            aria-label={t('Show prompt examples')}
            tooltip={t('Show prompt examples')}
          />
          {isLoading ? (
            <Button
              buttonStyle="primary"
              icon={<Icons.PauseCircleOutlined iconSize="m" />}
              onClick={() => {
                handleCancelRun();
              }}
              disabled={activeRunStatus === 'cancelling'}
              aria-label={t('Stop the assistant')}
              tooltip={t('Stop the assistant')}
            />
          ) : (
            <Button
              buttonStyle="primary"
              icon={<Icons.SendOutlined iconSize="m" />}
              onClick={() => {
                sendMessage();
              }}
              disabled={!inputValue.trim()}
              aria-label={t('Send')}
              tooltip={t('Send')}
            />
          )}
        </InputContainer>
      </ChatInput>
    </ChatPanelContainer>
  );
};

export default AiAssistantPanel;
