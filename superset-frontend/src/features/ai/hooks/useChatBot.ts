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
 * @fileoverview Conversation state and the send loop.
 *
 * Runs are tracked per conversation, not globally. That is the point of the
 * structure: a user can start something slow in one conversation, switch to
 * another and keep working, and come back to find the first still going. A single
 * `isLoading` flag would have made switching away cancel or corrupt the run.
 *
 * The server owns the transcript. A finished run is re-read from it rather than
 * assembled from the frames, so the tool calls persisted on the message are what
 * the user sees, and what they see survives a reload.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import { logging } from '@apache-superset/core/utils';
import { t } from '@apache-superset/core/translation';
import {
  type AiAgent,
  type AiToolCall,
  type ChatMessageWithMeta,
  type ChatTab,
  type CheckpointPayload,
} from '../types';
import {
  AGENT_STORAGE_KEY,
  ChatRequestAbortedError,
  ChatStreamEventError,
  ChatStreamTimeoutError,
  DEFAULT_AGENT_KEY,
  DEFAULT_CHAT_AGENT,
  cancelChatRun,
  describeRequestError,
  fetchAgents,
  fetchSuggestedPrompts,
  loadStoredAgentKey,
  normalizeChatAgents,
  startRun,
  streamRun,
  submitFeedback,
} from './chatRequest';
import {
  NEW_CHAT_NAME,
  createThread,
  deleteThread as deleteThreadApi,
  getThread,
  listThreads,
  threadToTab,
  updateThread,
} from './chatThreadsApi';
import { buildQuickPrompts } from './quickPrompts';
import {
  buildPageContextPayload,
  usePageContext,
  type PageContext,
} from './usePageContext';

/** Cache of the conversation list, so the menu renders before the list arrives. */
export const CHAT_TABS_STORAGE_KEY = 'superset-chat-tabs';

/** Which conversation was last open. */
export const ACTIVE_TAB_STORAGE_KEY = 'superset-chat-active-tab';

/** Recent inputs, recalled with the arrow keys. */
export const HISTORY_STORAGE_KEY = 'superset-chat-history';

export { AGENT_STORAGE_KEY } from './chatRequest';

/** How many inputs the arrow-key history keeps. */
const MAX_INPUT_HISTORY = 50;

/** A conversation title derived from a message is clipped to this. */
const MAX_TAB_NAME_LENGTH = 30;

export type ChatRunStatus = 'running' | 'cancelling';

/** Shared empty list, so a render with no steps yet keeps a stable identity. */
const EMPTY_TOOL_CALLS: AiToolCall[] = [];

interface ActiveChatRun {
  requestId: string;
  tabId: string;
  threadId: string;
  runId?: string;
  controller: AbortController;
  isStreaming: boolean;
  liveThoughts: string;
  liveToolLog: string;
  /**
   * Steps taken so far, as structured records rather than log lines.
   *
   * Carried alongside `liveToolLog` so a run in flight can be rendered the same
   * way a finished one is — expandable per step, with the SQL and the rows it
   * returned — instead of as a wall of text that only becomes legible once the
   * transcript is re-read from the server.
   */
  liveToolCalls: AiToolCall[];
  /** The page context this run was given, so the live view can show it too. */
  livePageContext?: string;
  /**
   * The answer so far, as the model produces it.
   *
   * Rendered directly: the deltas used to be folded into `liveThinking`, which
   * nothing displayed, so an answer appeared in one piece the moment the run
   * ended however long it had taken to generate.
   */
  liveAnswer: string;
  liveThinking: string;
  status: ChatRunStatus;
  startedAt: number;
  checkpoint: CheckpointPayload | null;
}

/**
 * An identifier for a turn.
 *
 * Drawn from `crypto`, not `Math.random`. These become the idempotency key on a
 * turn and the handle used to cancel one, so a value another session could guess
 * is a correctness and a security problem rather than merely a collision risk.
 */
const generateId = (): string => {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Older engines expose the entropy source without the convenience wrapper.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
};

const createNewTab = (name: string = NEW_CHAT_NAME): ChatTab => ({
  id: generateId(),
  name,
  messages: [],
  createdAt: Date.now(),
});

const truncateTabName = (
  name: string,
  maxLength: number = MAX_TAB_NAME_LENGTH,
): string =>
  name.length <= maxLength ? name : `${name.substring(0, maxLength)}...`;

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch (caught) {
    logging.warn(`[ai] could not read ${key}`, caught);
    return fallback;
  }
};

const writeJson = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (caught) {
    logging.warn(`[ai] could not write ${key}`, caught);
  }
};

/**
 * Reconciles the server's transcript with what is already on screen.
 *
 * The server's copy is authoritative — it carries the tool calls — but it is not
 * necessarily complete the moment a run ends, and replacing outright would then
 * erase an answer the user has just read. So anything local that the server has
 * not accounted for is kept, matched by identity first and by role and content
 * second, which is how a locally-appended turn is recognised once the server
 * returns its own copy of it under a real uuid.
 */
export const mergeMessages = (
  fromServer: ChatMessageWithMeta[],
  local: ChatMessageWithMeta[],
): ChatMessageWithMeta[] => {
  const serverIds = new Set(fromServer.map(message => message.id));
  const serverTurns = new Set(
    fromServer.map(message => `${message.role}:${message.content}`),
  );
  const unaccounted = local.filter(
    message =>
      !serverIds.has(message.id) &&
      !serverTurns.has(`${message.role}:${message.content}`),
  );
  return [...fromServer, ...unaccounted];
};

/**
 * The `page_context` body for one turn.
 *
 * Returns undefined when there is nothing to send, so an omitted field is
 * distinguishable from an empty one.
 */
export const buildRequestPageContext = (
  context: PageContext | undefined,
  directive?: string,
): Record<string, unknown> | undefined => {
  const payload = context ? buildPageContextPayload(context) : undefined;
  if (!directive) {
    return payload;
  }
  const existing = payload?.helper_directives;
  return {
    ...payload,
    helper_directives: [
      directive,
      ...(Array.isArray(existing) ? existing : []),
    ],
  };
};

export interface UseChatBotReturn {
  // Conversations
  chatTabs: ChatTab[];
  activeTabId: string;
  activeTab: ChatTab | undefined;
  threadsLoaded: boolean;
  handleNewChat: () => Promise<string>;
  handleSelectTab: (tabId: string) => Promise<void>;
  handleDeleteTab: (tabId: string) => Promise<void>;
  handleRenameTab: (tabId: string, newName: string) => void;
  // Messages of the active conversation
  messages: ChatMessageWithMeta[];
  // Input
  inputValue: string;
  setInputValue: (value: string) => void;
  handleKeyDown: (event: React.KeyboardEvent) => void;
  inputRef: React.RefObject<TextAreaRef>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  // The run in flight, if any, for the active conversation
  isLoading: boolean;
  isStreamingResponse: boolean;
  liveThoughts: string;
  liveToolLog: string;
  /** Steps taken so far in the run in flight, for the structured live view. */
  liveToolCalls: AiToolCall[];
  /** The page context the run in flight was given. */
  livePageContext?: string;
  /** The answer so far for the run in flight. */
  liveAnswer: string;
  checkpoint: CheckpointPayload | null;
  activeRunStatus: ChatRunStatus | null;
  error?: string;
  // Actions
  sendMessage: (
    messageOverride?: string,
    systemPromptOverride?: string,
  ) => Promise<void>;
  handleCancelRun: () => Promise<void>;
  handleCheckpointContinue: () => void;
  handleFeedback: (messageId: string, feedback: 'like' | 'dislike') => void;
  messageFeedback: Record<string, 'like' | 'dislike'>;
  // Suggestions
  /** The message whose run just ended; its thought process stays open. */
  justCompletedId?: string;
  quickPrompts: string[];
  loadQuickPrompts: () => void;
  applyQuickPrompt: (prompt: string) => Promise<void>;
  // Agent profiles
  agents: AiAgent[];
  selectedAgent: string;
  setSelectedAgent: (key: string) => void;
  // Page context
  pageContext: PageContext;
  includePageContext: boolean;
  toggleIncludePageContext: () => void;
}

export const useChatBot = (): UseChatBotReturn => {
  const [chatTabs, setChatTabs] = useState<ChatTab[]>(() =>
    readJson<ChatTab[]>(CHAT_TABS_STORAGE_KEY, []).map(tab => ({
      // The cache is a placeholder for the menu; message bodies are re-read from
      // the server so a stale cache cannot show a conversation that has moved on.
      ...tab,
      messages: [],
    })),
  );
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    try {
      return localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [threadsLoaded, setThreadsLoaded] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const [inputValue, setInputValue] = useState('');
  const [activeRunsByTab, setActiveRunsByTab] = useState<
    Record<string, ActiveChatRun>
  >({});
  const [quickPrompts, setQuickPrompts] = useState<string[]>([]);
  const [messageFeedback, setMessageFeedback] = useState<
    Record<string, 'like' | 'dislike'>
  >({});
  const [includePageContext, setIncludePageContext] = useState(true);
  /**
   * The assistant message whose run has only just ended.
   *
   * Its thought process stays open, because collapsing it the instant the answer
   * lands moves everything below it — the answer the user is mid-sentence through
   * jumps up the panel. Older messages start closed.
   */
  const [justCompletedId, setJustCompletedId] = useState<string | undefined>();
  const [agents, setAgents] = useState<AiAgent[]>([DEFAULT_CHAT_AGENT]);
  const [selectedAgent, setSelectedAgent] = useState<string>(() =>
    loadStoredAgentKey(AGENT_STORAGE_KEY),
  );

  const [messageHistory, setMessageHistory] = useState<string[]>(() =>
    readJson<string[]>(HISTORY_STORAGE_KEY, []),
  );
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentDraft, setCurrentDraft] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<TextAreaRef>(null);

  /**
   * The run map and the conversation list are also held in refs, and the refs are
   * the authority.
   *
   * The send loop has to ask "is this still my run?" between awaits, and it cannot
   * ask React: a run that starts and fails inside one batch never causes a render,
   * so a ref synced at render time would still be empty and the loop would discard
   * its own result as stale. Writing the ref at the point of mutation removes that
   * window. The callbacks read the refs rather than the state so their identities
   * do not churn on every streamed frame, which would restart effects mid-run.
   */
  const activeRunsByTabRef = useRef<Record<string, ActiveChatRun>>({});
  const chatTabsRef = useRef<ChatTab[]>(chatTabs);
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  const updateRuns = useCallback(
    (
      updater: (
        previous: Record<string, ActiveChatRun>,
      ) => Record<string, ActiveChatRun>,
    ) => {
      activeRunsByTabRef.current = updater(activeRunsByTabRef.current);
      setActiveRunsByTab(activeRunsByTabRef.current);
    },
    [],
  );

  const updateTabs = useCallback(
    (updater: (previous: ChatTab[]) => ChatTab[]) => {
      chatTabsRef.current = updater(chatTabsRef.current);
      setChatTabs(chatTabsRef.current);
    },
    [],
  );

  /** Resolved when the user answers a checkpoint; see `streamRun`. */
  const checkpointGateRef = useRef<{ resolve: () => void } | null>(null);
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  const activeTab = chatTabs.find(tab => tab.id === activeTabId);
  const messages = activeTab?.messages ?? [];

  const activeRun = activeRunsByTab[activeTabId];
  const isLoading = Boolean(activeRun);
  const isStreamingResponse = activeRun?.isStreaming ?? false;
  const liveThoughts = activeRun?.liveThoughts ?? '';
  const liveToolLog = activeRun?.liveToolLog ?? '';
  const liveToolCalls = activeRun?.liveToolCalls ?? EMPTY_TOOL_CALLS;
  const livePageContext = activeRun?.livePageContext;
  const liveAnswer = activeRun?.liveAnswer ?? '';
  const checkpoint = activeRun?.checkpoint ?? null;
  const activeRunStatus = activeRun?.status ?? null;

  const pageContext = usePageContext();
  const pageContextRef = useRef(pageContext);
  pageContextRef.current = pageContext;

  const fail = useCallback(async (caught: unknown, fallback: string) => {
    const message = await describeRequestError(caught, fallback);
    logging.error('[ai] assistant request failed', caught);
    if (mountedRef.current) {
      setError(message);
    }
  }, []);

  // -----------------------------------------------------------------------
  // Persistence of the small things
  // -----------------------------------------------------------------------

  useEffect(() => {
    // Only the shell of each conversation is cached; see the initialiser.
    writeJson(
      CHAT_TABS_STORAGE_KEY,
      chatTabs.map(tab => ({ ...tab, messages: [] })),
    );
  }, [chatTabs]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTabId);
    } catch (caught) {
      logging.warn('[ai] could not remember the active conversation', caught);
    }
  }, [activeTabId]);

  useEffect(() => {
    if (messageHistory.length > 0) {
      writeJson(HISTORY_STORAGE_KEY, messageHistory);
    }
  }, [messageHistory]);

  useEffect(() => {
    try {
      localStorage.setItem(AGENT_STORAGE_KEY, selectedAgent);
    } catch (caught) {
      logging.warn('[ai] could not remember the selected agent', caught);
    }
  }, [selectedAgent]);

  // Follows the transcript as it grows, including while a run streams. Guarded
  // because `scrollIntoView` is absent in environments without a layout engine,
  // and failing to scroll must not take the panel down.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages, liveToolLog, liveThoughts]);

  // -----------------------------------------------------------------------
  // Conversation management
  // -----------------------------------------------------------------------

  const setMessagesForTab = useCallback(
    (
      tabId: string,
      updater: (previous: ChatMessageWithMeta[]) => ChatMessageWithMeta[],
    ) => {
      updateTabs(previous =>
        previous.map(tab =>
          tab.id === tabId ? { ...tab, messages: updater(tab.messages) } : tab,
        ),
      );
    },
    [updateTabs],
  );

  const refreshThreadMessages = useCallback(
    async (threadId: string) => {
      const { thread, messages: threadMessages } = await getThread(threadId);
      if (!mountedRef.current) {
        return;
      }
      const refreshed = threadToTab(thread, threadMessages);
      // A locally set title wins: the user may have renamed the conversation
      // while the request was in flight.
      updateTabs(previous =>
        previous.map(tab =>
          tab.threadId === threadId
            ? {
                ...refreshed,
                name: tab.name || refreshed.name,
                messages: mergeMessages(refreshed.messages, tab.messages),
              }
            : tab,
        ),
      );
    },
    [updateTabs],
  );

  const handleNewChat = useCallback(async (): Promise<string> => {
    try {
      const thread = await createThread(
        undefined,
        selectedAgent === DEFAULT_AGENT_KEY ? undefined : selectedAgent,
      );
      const tab = threadToTab(thread);
      updateTabs(previous => [tab, ...previous]);
      setActiveTabId(tab.id);
      activeTabIdRef.current = tab.id;
      setError(undefined);
      return tab.id;
    } catch (caught) {
      await fail(caught, t('The conversation could not be created.'));
      // A local tab still lets the user type; the thread is created on send.
      const tab = createNewTab();
      updateTabs(previous => [tab, ...previous]);
      setActiveTabId(tab.id);
      activeTabIdRef.current = tab.id;
      return tab.id;
    }
  }, [fail, selectedAgent, updateTabs]);

  const handleSelectTab = useCallback(
    async (tabId: string) => {
      setActiveTabId(tabId);
      const tab = chatTabsRef.current.find(candidate => candidate.id === tabId);
      // Messages are fetched on first view, not up front: a user with fifty
      // conversations should not pay for forty-nine of them.
      if (tab?.threadId && tab.messages.length === 0) {
        try {
          await refreshThreadMessages(tab.threadId);
        } catch (caught) {
          await fail(caught, t('The conversation could not be loaded.'));
        }
      }
    },
    [fail, refreshThreadMessages],
  );

  const handleDeleteTab = useCallback(
    async (tabId: string) => {
      const tab = chatTabsRef.current.find(candidate => candidate.id === tabId);
      if (tab?.threadId) {
        try {
          await deleteThreadApi(tab.threadId);
        } catch (caught) {
          await fail(caught, t('The conversation could not be deleted.'));
          return;
        }
      }
      updateTabs(previous => {
        const remaining = previous.filter(candidate => candidate.id !== tabId);
        if (tabId === activeTabIdRef.current) {
          setActiveTabId(remaining[0]?.id ?? '');
          activeTabIdRef.current = remaining[0]?.id ?? '';
        }
        return remaining;
      });
    },
    [fail, updateTabs],
  );

  const handleRenameTab = useCallback(
    (tabId: string, newName: string) => {
      const trimmedName = newName.trim();
      if (!trimmedName) {
        return;
      }
      const tab = chatTabsRef.current.find(candidate => candidate.id === tabId);
      updateTabs(previous =>
        previous.map(candidate =>
          candidate.id === tabId
            ? { ...candidate, name: trimmedName }
            : candidate,
        ),
      );
      // Renamed locally first, then on the server: the menu should not wait for a
      // round trip to show what the user just typed.
      if (tab?.threadId) {
        updateThread(tab.threadId, { title: trimmedName }).catch(caught => {
          logging.warn('[ai] could not rename the conversation', caught);
        });
      }
    },
    [updateTabs],
  );

  /** Titles an untitled conversation after its first message. */
  const nameTabFromMessage = useCallback(
    (tabId: string, threadId: string, message: string) => {
      const title = truncateTabName(message);
      updateTabs(previous =>
        previous.map(tab =>
          tab.id === tabId && tab.name === NEW_CHAT_NAME
            ? { ...tab, name: title }
            : tab,
        ),
      );
      updateThread(threadId, { title }).catch(caught => {
        logging.warn('[ai] could not title the conversation', caught);
      });
    },
    [updateTabs],
  );

  /**
   * The thread backing a tab, creating it if the tab is only local.
   *
   * A tab's id becomes its thread uuid once it has one, so the id is rewritten
   * here and the new one returned — callers must use it from then on.
   */
  const ensureThread = useCallback(
    async (tabId: string): Promise<{ tabId: string; threadId: string }> => {
      const tab = chatTabsRef.current.find(candidate => candidate.id === tabId);
      if (tab?.threadId) {
        return { tabId, threadId: tab.threadId };
      }
      const thread = await createThread(
        undefined,
        selectedAgent === DEFAULT_AGENT_KEY ? undefined : selectedAgent,
      );
      updateTabs(previous =>
        previous.map(candidate =>
          candidate.id === tabId
            ? { ...candidate, id: thread.uuid, threadId: thread.uuid }
            : candidate,
        ),
      );
      if (activeTabIdRef.current === tabId) {
        setActiveTabId(thread.uuid);
        activeTabIdRef.current = thread.uuid;
      }
      return { tabId: thread.uuid, threadId: thread.uuid };
    },
    [selectedAgent, updateTabs],
  );

  // -----------------------------------------------------------------------
  // Run bookkeeping
  // -----------------------------------------------------------------------

  const isRunCurrent = useCallback(
    (tabId: string, requestId: string): boolean => {
      const run = activeRunsByTabRef.current[tabId];
      return Boolean(run && run.requestId === requestId);
    },
    [],
  );

  const updateRunState = useCallback(
    (
      tabId: string,
      requestId: string,
      updater: (run: ActiveChatRun) => ActiveChatRun,
    ) => {
      updateRuns(previous => {
        const current = previous[tabId];
        if (!current || current.requestId !== requestId) {
          return previous;
        }
        return { ...previous, [tabId]: updater(current) };
      });
    },
    [updateRuns],
  );

  const clearRunIfMatches = useCallback(
    (tabId: string, requestId: string) => {
      updateRuns(previous => {
        const current = previous[tabId];
        if (!current || current.requestId !== requestId) {
          return previous;
        }
        const { [tabId]: _removed, ...rest } = previous;
        return rest;
      });
    },
    [updateRuns],
  );

  const releaseCheckpointGate = useCallback(() => {
    checkpointGateRef.current?.resolve();
    checkpointGateRef.current = null;
  }, []);

  const handleCheckpointContinue = useCallback(() => {
    releaseCheckpointGate();
    const tabId = activeTabIdRef.current;
    const run = activeRunsByTabRef.current[tabId];
    if (run) {
      updateRunState(tabId, run.requestId, current => ({
        ...current,
        checkpoint: null,
      }));
    }
  }, [releaseCheckpointGate, updateRunState]);

  const handleCancelRun = useCallback(async () => {
    const tabId = activeTabIdRef.current;
    const run = activeRunsByTabRef.current[tabId];
    if (!run) {
      return;
    }
    // A run paused at a checkpoint is not reading, so the gate is released first
    // or the abort would not be noticed until the user pressed Continue.
    releaseCheckpointGate();
    updateRunState(tabId, run.requestId, current => ({
      ...current,
      status: 'cancelling',
    }));
    run.controller.abort();
    if (run.runId) {
      try {
        await cancelChatRun(run.threadId, run.runId);
      } catch (caught) {
        // Cancellation is cooperative and best-effort; the reader has already
        // stopped, so a failure here is worth a log and nothing more.
        logging.warn('[ai] the assistant was not told to stop', caught);
      }
    }
    clearRunIfMatches(tabId, run.requestId);
  }, [clearRunIfMatches, releaseCheckpointGate, updateRunState]);

  // -----------------------------------------------------------------------
  // Sending
  // -----------------------------------------------------------------------

  /**
   * Returns focus to the composer after a run, with the caret at the end.
   *
   * The caret matters: an input that regains focus with the caret at position
   * zero puts the next keystroke in front of whatever the user had typed.
   */
  const focusInput = useCallback(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    input.focus();
    const element = input.resizableTextArea?.textArea;
    element?.setSelectionRange(element.value.length, element.value.length);
  }, []);

  const sendMessage = useCallback(
    async (messageOverride?: string, systemPromptOverride?: string) => {
      const source = messageOverride ?? inputValue;
      const trimmedMessage = source.trim();
      const originTabId = activeTabIdRef.current;
      if (!trimmedMessage || activeRunsByTabRef.current[originTabId]) {
        return;
      }

      const requestId = generateId();
      const controller = new AbortController();

      setMessageHistory(previous =>
        [
          trimmedMessage,
          ...previous.filter(entry => entry !== trimmedMessage),
        ].slice(0, MAX_INPUT_HISTORY),
      );
      setHistoryIndex(-1);
      setCurrentDraft('');
      setInputValue('');
      setQuickPrompts([]);
      setError(undefined);

      let targetTabId = originTabId;
      let threadId: string;
      try {
        const ensured = await ensureThread(originTabId);
        targetTabId = ensured.tabId;
        threadId = ensured.threadId;
      } catch (caught) {
        await fail(caught, t('The conversation could not be created.'));
        setInputValue(trimmedMessage);
        return;
      }

      const isFirstMessage = !(
        chatTabsRef.current
          .find(tab => tab.id === targetTabId)
          ?.messages.some(message => message.role === 'user') ?? false
      );
      if (isFirstMessage) {
        nameTabFromMessage(targetTabId, threadId, trimmedMessage);
      }

      // Shown before the request returns: a run can take seconds to produce its
      // first frame, and an input that empties into nothing reads as a failure.
      setMessagesForTab(targetTabId, previous => [
        ...previous,
        {
          id: `local-${requestId}`,
          role: 'user',
          content: trimmedMessage,
          timestamp: Date.now(),
          pending: true,
        },
      ]);

      // There is no system-message channel in this contract, so a directive from
      // an AI action travels with the page context, which is the field the
      // backend already turns into prompt preamble.
      const directive = systemPromptOverride?.trim();
      const contextPayload = buildRequestPageContext(
        includePageContext ? pageContextRef.current : undefined,
        directive,
      );

      // What was sent about the user's screen, for the "Context used" step. The
      // payload's own rendering is used rather than re-deriving one: it is the
      // text the backend was given, so showing anything else would misreport
      // what the answer was based on. The server records its own copy, which
      // supersedes this once the transcript is re-read.
      const contextSummary =
        typeof contextPayload?.formatted === 'string' &&
        contextPayload.formatted.trim()
          ? contextPayload.formatted
          : undefined;

      updateRuns(previous => ({
        ...previous,
        [targetTabId]: {
          requestId,
          tabId: targetTabId,
          threadId,
          controller,
          isStreaming: true,
          liveThoughts: t('Starting analysis...'),
          liveToolLog: '',
          liveToolCalls: [],
          livePageContext: contextSummary,
          liveAnswer: '',
          liveThinking: t('Starting analysis...'),
          status: 'running',
          startedAt: Date.now(),
          checkpoint: null,
        },
      }));

      // Progress lines and completed steps are kept apart. A progress line is
      // prose about what is happening now and has no structured form; a step is
      // rendered from its record. Merging them into one text log meant a step
      // appeared twice — once as a line, once as a row — and made the log the
      // headline of a finished answer.
      const progressSteps: string[] = [];
      const toolCallSteps: AiToolCall[] = [];
      let currentThoughts = '';
      let currentToolLog = '';
      let assistantDeltaText = '';

      const publish = () => {
        updateRunState(targetTabId, requestId, run => ({
          ...run,
          liveThoughts: currentThoughts,
          liveToolLog: currentToolLog,
          liveToolCalls: [...toolCallSteps],
          liveAnswer: assistantDeltaText,
          liveThinking: [currentThoughts, currentToolLog, assistantDeltaText]
            .filter(Boolean)
            .join('\n\n'),
        }));
      };

      const accumulatedThinking = (): string | undefined =>
        [currentThoughts, currentToolLog].filter(Boolean).join('\n\n') ||
        undefined;

      /**
       * Adds the assistant's turn to the transcript.
       *
       * Carries the structured record as well as the flat log, because the panel
       * renders the two differently and the difference was visible: a turn that
       * had only just streamed showed a plain progress line, and the expandable
       * steps and the context it was given appeared only after the transcript
       * was re-read — which to a user looks like they arrive on page refresh. The
       * client already holds all three, so there is no reason to wait for the
       * server to hand them back.
       *
       * The server's copy still supersedes this one; see `mergeMessages`.
       */
      const appendAssistant = (
        content: string,
        id: string = `local-${requestId}-reply`,
      ) => {
        setJustCompletedId(id);
        setMessagesForTab(targetTabId, previous => [
          ...previous,
          {
            id,
            role: 'assistant',
            content,
            timestamp: Date.now(),
            thinking: accumulatedThinking(),
            thoughts: currentThoughts.trim() || undefined,
            pageContext: contextSummary,
            toolCalls: toolCallSteps.length ? [...toolCallSteps] : undefined,
            pending: id.startsWith('local-'),
          },
        ]);
      };

      /**
       * Retires the run, reporting whether it was still the current one.
       *
       * Called before an outcome is written to the transcript. The progress
       * bubble is driven by the presence of a run, so appending the finished
       * answer while the run was still registered showed a completed reply with
       * a "working on your question" bubble underneath it — for as long as the
       * subsequent transcript re-read took, and indefinitely if that re-read
       * never returned.
       */
      const retireRun = (): boolean => {
        const wasCurrent = isRunCurrent(targetTabId, requestId);
        clearRunIfMatches(targetTabId, requestId);
        return wasCurrent;
      };

      try {
        const run = await startRun({
          threadUuid: threadId,
          content: trimmedMessage,
          requestId,
          agentKey: selectedAgent,
          pageContext: contextPayload,
        });
        updateRunState(targetTabId, requestId, current => ({
          ...current,
          runId: run.runId,
        }));

        const result = await streamRun({
          threadUuid: threadId,
          runId: run.runId,
          signal: controller.signal,
          onThoughts: delta => {
            if (!isRunCurrent(targetTabId, requestId)) return;
            currentThoughts += delta;
            publish();
          },
          onThinking: line => {
            if (!isRunCurrent(targetTabId, requestId)) return;
            // Consecutive duplicates are dropped: the backend re-announces a
            // stage on retry and a repeated line reads as a stuck run.
            if (progressSteps[progressSteps.length - 1] === line) return;
            progressSteps.push(line);
            currentToolLog = progressSteps.join('\n');
            publish();
          },
          onAssistantDelta: delta => {
            if (!isRunCurrent(targetTabId, requestId)) return;
            assistantDeltaText += delta;
            publish();
          },
          onAssistantFinal: content => {
            if (!isRunCurrent(targetTabId, requestId)) return;
            assistantDeltaText = content;
            publish();
          },
          onCheckpoint: parsed => {
            if (!isRunCurrent(targetTabId, requestId)) {
              return Promise.resolve();
            }
            if (parsed.toolCall) {
              toolCallSteps.push(parsed.toolCall);
            }
            if (!parsed.requiresConfirmation) {
              // A milestone, not a gate: record it and keep reading. Blocking
              // here on every finished tool call left the panel showing
              // progress for as long as the timeout allowed after the answer
              // had already been delivered.
              updateRunState(targetTabId, requestId, current => ({
                ...current,
                liveToolLog: currentToolLog,
                liveToolCalls: [...toolCallSteps],
              }));
              return Promise.resolve();
            }
            return new Promise<void>(resolve => {
              checkpointGateRef.current = { resolve };
              updateRunState(targetTabId, requestId, current => ({
                ...current,
                liveToolLog: currentToolLog,
                liveToolCalls: [...toolCallSteps],
                checkpoint: parsed,
              }));
            });
          },
        });

        if (!retireRun()) {
          return;
        }
        if (result.cancelled) {
          appendAssistant(result.content || t('*Response cancelled.*'));
          return;
        }
        appendAssistant(
          result.content,
          run.assistantMessageUuid ?? `local-${requestId}-reply`,
        );
        // The server's copy carries the tool calls, so it supersedes what was
        // assembled from the frames (see `mergeMessages`).
        try {
          await refreshThreadMessages(threadId);
        } catch (caught) {
          logging.warn('[ai] could not re-read the conversation', caught);
        }
      } catch (caught) {
        if (caught instanceof ChatRequestAbortedError) {
          retireRun();
          const partial = assistantDeltaText.trim();
          if (partial || accumulatedThinking()) {
            appendAssistant(partial || t('*Response cancelled.*'));
          }
          return;
        }
        if (!retireRun()) {
          return;
        }
        if (caught instanceof ChatStreamTimeoutError) {
          logging.warn('[ai] the assistant stream timed out', caught.runId);
          appendAssistant(
            t(
              'The response was taking too long and could not be completed. Please try sending your message again.',
            ),
          );
          return;
        }
        const detail =
          caught instanceof ChatStreamEventError || caught instanceof Error
            ? caught.message
            : await describeRequestError(caught, t('Unknown error occurred'));
        logging.error('[ai] the assistant run failed', caught);
        const partial = assistantDeltaText.trim();
        appendAssistant(
          partial
            ? `${partial}\n\n---\n_${detail}_`
            : t('The assistant could not answer: %s', detail),
        );
      } finally {
        clearRunIfMatches(targetTabId, requestId);
        focusInput();
      }
    },
    [
      clearRunIfMatches,
      ensureThread,
      fail,
      focusInput,
      includePageContext,
      inputValue,
      isRunCurrent,
      nameTabFromMessage,
      refreshThreadMessages,
      selectedAgent,
      setMessagesForTab,
      updateRunState,
      updateRuns,
    ],
  );

  // -----------------------------------------------------------------------
  // Suggestions, feedback and input history
  // -----------------------------------------------------------------------

  /**
   * Fills the suggestion row, from the backend where that is configured.
   *
   * The locally derived set is shown immediately so the row is never empty while
   * the request is in flight, and it stands as the answer whenever the backend
   * has nothing better — the deployment has not enabled generation, it had
   * nothing to suggest for this page, or the request failed. Pressing the button
   * therefore always produces suggestions, which is the point of it.
   *
   * Only this explicit request reaches the backend. The suggestions shown
   * automatically for a fresh conversation stay local, so merely navigating
   * around Superset with the panel open does not spend a model call per page.
   */
  const loadQuickPrompts = useCallback(() => {
    const context = pageContextRef.current;
    setQuickPrompts(buildQuickPrompts(context));
    fetchSuggestedPrompts(buildPageContextPayload(context))
      .then(({ prompts }) => {
        if (mountedRef.current && prompts.length > 0) {
          setQuickPrompts(prompts);
        }
      })
      .catch(caught => {
        logging.warn('[ai] could not load suggested prompts', caught);
      });
  }, []);

  const applyQuickPrompt = useCallback(
    async (prompt: string) => {
      const trimmedPrompt = prompt.trim();
      if (!trimmedPrompt) {
        return;
      }
      await sendMessage(trimmedPrompt);
    },
    [sendMessage],
  );

  const handleFeedback = useCallback(
    (messageId: string, feedback: 'like' | 'dislike') => {
      const message = messages.find(candidate => candidate.id === messageId);
      if (!message || message.role !== 'assistant' || message.pending) {
        return;
      }
      // A verdict can be changed — a mis-click should be correctable — but not
      // withdrawn: the table holds one row per user per message and there is no
      // endpoint to delete one, so re-pressing the verdict already recorded is
      // the only no-op. Changing it is an update in place on the server.
      const recorded = messageFeedback[messageId];
      if (recorded === feedback) {
        return;
      }
      setMessageFeedback(previous => ({ ...previous, [messageId]: feedback }));
      submitFeedback(messageId, feedback === 'like').catch(caught => {
        logging.warn('[ai] feedback was not recorded', caught);
        // Restored to whatever was there before, which for a change of mind is
        // the previous verdict rather than nothing: showing a rating that was
        // never stored would misreport what the server holds.
        setMessageFeedback(previous => {
          if (recorded) {
            return { ...previous, [messageId]: recorded };
          }
          const { [messageId]: _failed, ...rest } = previous;
          return rest;
        });
      });
    },
    [messageFeedback, messages],
  );

  // Ratings arrive with the transcript, so one left before a reload is shown
  // rather than offered again. Merged with what is already held, because a
  // rating just left locally has no server copy yet.
  useEffect(() => {
    const stored: Record<string, 'like' | 'dislike'> = {};
    messages.forEach(message => {
      if (message.liked !== undefined) {
        stored[message.id] = message.liked ? 'like' : 'dislike';
      }
    });
    if (Object.keys(stored).length > 0) {
      setMessageFeedback(previous => ({ ...stored, ...previous }));
    }
  }, [messages]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
        return;
      }
      if (event.key === 'ArrowUp') {
        if (inputValue && historyIndex === -1) {
          return;
        }
        event.preventDefault();
        if (historyIndex === -1 && inputValue) {
          setCurrentDraft(inputValue);
        }
        const nextIndex = Math.min(historyIndex + 1, messageHistory.length - 1);
        if (nextIndex >= 0 && nextIndex < messageHistory.length) {
          setHistoryIndex(nextIndex);
          setInputValue(messageHistory[nextIndex]);
        }
        return;
      }
      if (event.key === 'ArrowDown' && historyIndex > -1) {
        event.preventDefault();
        if (historyIndex > 0) {
          const nextIndex = historyIndex - 1;
          setHistoryIndex(nextIndex);
          setInputValue(messageHistory[nextIndex]);
        } else {
          setHistoryIndex(-1);
          setInputValue(currentDraft);
          setCurrentDraft('');
        }
      }
    },
    [currentDraft, historyIndex, inputValue, messageHistory, sendMessage],
  );

  const handleInputChange = useCallback(
    (value: string) => {
      setInputValue(value);
      if (historyIndex !== -1) {
        setHistoryIndex(-1);
        setCurrentDraft('');
      }
    },
    [historyIndex],
  );

  const toggleIncludePageContext = useCallback(() => {
    setIncludePageContext(previous => !previous);
  }, []);

  // -----------------------------------------------------------------------
  // Initial load
  // -----------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const threads = await listThreads();
        if (cancelled || !mountedRef.current) {
          return;
        }
        if (threads.length === 0) {
          // Created eagerly so the first message does not pay for it, and so the
          // panel is never in a state with no conversation at all.
          const thread = await createThread();
          if (cancelled || !mountedRef.current) {
            return;
          }
          const tab = threadToTab(thread);
          updateTabs(() => [tab]);
          setActiveTabId(tab.id);
          activeTabIdRef.current = tab.id;
          return;
        }
        const tabs = threads.map(thread => threadToTab(thread));
        const preferred =
          tabs.find(tab => tab.id === activeTabIdRef.current) ?? tabs[0];
        updateTabs(() => tabs);
        setActiveTabId(preferred.id);
        activeTabIdRef.current = preferred.id;
        if (preferred.threadId) {
          await refreshThreadMessages(preferred.threadId);
        }
      } catch (caught) {
        await fail(caught, t('Conversations could not be loaded.'));
      } finally {
        if (!cancelled && mountedRef.current) {
          setThreadsLoaded(true);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [fail, refreshThreadMessages, updateTabs]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const fetched = await fetchAgents();
        if (cancelled || !mountedRef.current) {
          return;
        }
        const normalized = normalizeChatAgents(fetched);
        setAgents(normalized);
        setSelectedAgent(current =>
          normalized.some(agent => agent.key === current)
            ? current
            : DEFAULT_AGENT_KEY,
        );
      } catch (caught) {
        // A missing profile list is not fatal: the backend picks a default, so
        // the panel stays usable without a selector.
        logging.warn('[ai] could not load agent profiles', caught);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Suggestions for a conversation that has not been used yet. Re-derived when
  // the user navigates, because the suggestions name what is on screen.
  useEffect(() => {
    if (!threadsLoaded || isLoading) {
      return;
    }
    if (messages.some(message => message.role === 'user')) {
      setQuickPrompts([]);
      return;
    }
    setQuickPrompts(buildQuickPrompts(pageContext));
  }, [threadsLoaded, isLoading, messages, pageContext]);

  return {
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
    setInputValue: handleInputChange,
    handleKeyDown,
    inputRef,
    messagesEndRef,
    isLoading,
    isStreamingResponse,
    liveThoughts,
    liveToolLog,
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
  };
};
