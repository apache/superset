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
 * @fileoverview Conversation CRUD against `/api/v1/ai/thread/`.
 *
 * Requests go through `SupersetClient`, which attaches the CSRF token and the
 * session cookie, so there is no token handling here. Every response body is run
 * through the parsers in `types.ts` rather than cast.
 */

import { SupersetClient } from '@superset-ui/core';
import {
  type AiMessage,
  type AiThread,
  type ChatMessageWithMeta,
  type ChatTab,
  type JsonRecord,
  isDefined,
  parseMessage,
  parseThread,
  readRecord,
  readRecordArray,
} from '../types';
import { describeToolCalls, THREAD_ENDPOINT } from './chatRequest';

/** How many conversations the history menu lists. */
export const THREAD_LIST_LIMIT = 50;

export interface ThreadWithMessages {
  thread: AiThread;
  messages: AiMessage[];
}

const bodyOf = (json: { [key: string]: unknown }): JsonRecord =>
  json as JsonRecord;

export const createThread = async (
  title?: string,
  agentKey?: string,
): Promise<AiThread> => {
  const { json } = await SupersetClient.post({
    endpoint: THREAD_ENDPOINT,
    jsonPayload: {
      ...(title ? { title } : {}),
      ...(agentKey ? { agent_key: agentKey } : {}),
    },
  });
  const thread = parseThread(readRecord(bodyOf(json), 'result'));
  if (!thread) {
    throw new Error('The assistant returned no conversation.');
  }
  return thread;
};

export const listThreads = async (
  limit: number = THREAD_LIST_LIMIT,
): Promise<AiThread[]> => {
  const { json } = await SupersetClient.get({
    endpoint: `${THREAD_ENDPOINT}?limit=${limit}`,
  });
  return readRecordArray(bodyOf(json), 'result')
    .map(parseThread)
    .filter(isDefined);
};

export const getThread = async (
  threadUuid: string,
): Promise<ThreadWithMessages> => {
  const { json } = await SupersetClient.get({
    endpoint: `${THREAD_ENDPOINT}${encodeURIComponent(threadUuid)}`,
  });
  const result = readRecord(bodyOf(json), 'result') ?? {};
  const thread = parseThread(result);
  if (!thread) {
    throw new Error('The assistant returned no conversation.');
  }
  return {
    thread,
    messages: readRecordArray(result, 'messages')
      .map(parseMessage)
      .filter(isDefined),
  };
};

export const updateThread = async (
  threadUuid: string,
  updates: { title?: string; status?: 'active' | 'archived' },
): Promise<void> => {
  await SupersetClient.put({
    endpoint: `${THREAD_ENDPOINT}${encodeURIComponent(threadUuid)}`,
    jsonPayload: updates,
  });
};

export const deleteThread = async (threadUuid: string): Promise<void> => {
  await SupersetClient.delete({
    endpoint: `${THREAD_ENDPOINT}${encodeURIComponent(threadUuid)}`,
  });
};

/** Name shown for a conversation the user has not titled. */
export const NEW_CHAT_NAME = 'New Chat';

/**
 * Turns a server message into the shape the panel renders.
 *
 * Reasoning and the tool log are collapsed into one `thinking` string because
 * that is what the "Thought process" block shows; the structured calls are kept
 * alongside it so a renderer that wants them does not have to re-parse.
 */
export const messageToChatMessage = (
  message: AiMessage,
): ChatMessageWithMeta => {
  const toolLog = message.toolCalls.length
    ? describeToolCalls(message.toolCalls)
    : '';
  const thinking = [message.thoughts, toolLog].filter(Boolean).join('\n\n');
  return {
    id: message.uuid,
    // A `system` message is not shown as a bubble; the panel filters those out
    // before this is reached, so anything that arrives here is a visible turn.
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: message.content,
    timestamp: message.createdOn
      ? new Date(message.createdOn).getTime()
      : Date.now(),
    thinking: thinking || undefined,
    thoughts: message.thoughts || undefined,
    pageContext: message.pageContext || undefined,
    toolCalls: message.toolCalls.length ? message.toolCalls : undefined,
    liked: message.liked,
  };
};

/**
 * Maps a conversation to a tab.
 *
 * A tab's id *is* the thread uuid, so selecting a tab needs no lookup table and
 * a reload cannot mismatch the two.
 */
export const threadToTab = (
  thread: AiThread,
  messages: AiMessage[] = [],
): ChatTab => ({
  id: thread.uuid,
  name: thread.title || NEW_CHAT_NAME,
  messages: messages
    .filter(message => message.role !== 'system')
    .map(messageToChatMessage),
  createdAt: thread.createdOn
    ? new Date(thread.createdOn).getTime()
    : Date.now(),
  updatedAt: thread.changedOn
    ? new Date(thread.changedOn).getTime()
    : undefined,
  messageCount: thread.messageCount,
  threadId: thread.uuid,
});
