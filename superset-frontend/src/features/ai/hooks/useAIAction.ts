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
 * @fileoverview How the rest of the app asks the assistant something.
 *
 * A "Debug this query" button in SQL Lab, or a chart menu item, needs to open the
 * assistant with a question already asked. It does that by dispatching one DOM
 * event that the panel listens for.
 *
 * The event wakes a mounted panel; the queue retains actions while its host
 * opens and loads conversations.
 */

import { useCallback } from 'react';
import { chat } from 'src/core/chat';
import type { AIActionPayload } from '../types';

/** The event the panel listens for. */
export const AI_ACTION_EVENT = 'superset-ai-action';

export type AiActionEvent = CustomEvent<AIActionPayload>;

const pendingActions: AIActionPayload[] = [];

/** Retain an action until the panel is ready to start its conversation. */
export const queueAIAction = (payload: AIActionPayload): void => {
  if (payload.prompt.trim()) {
    pendingActions.push(payload);
  }
};

/** A mounted panel claims each action once. */
export const takePendingAIAction = (): AIActionPayload | undefined =>
  pendingActions.shift();

/**
 * Asks the assistant a question in a new conversation.
 *
 * The payload survives opening an unmounted panel; no render timing is assumed.
 */
export const triggerAIAction = (payload: AIActionPayload): void => {
  if (!payload.prompt.trim()) {
    return;
  }
  queueAIAction(payload);
  chat.open();
  window.dispatchEvent(new Event(AI_ACTION_EVENT));
};

export interface UseAIActionResult {
  triggerAction: (payload: AIActionPayload) => void;
  /** Opens the assistant without asking anything. */
  openAssistant: () => void;
}

export const useAIAction = (): UseAIActionResult => {
  const triggerAction = useCallback((payload: AIActionPayload) => {
    triggerAIAction(payload);
  }, []);
  const openAssistant = useCallback(() => {
    chat.open();
  }, []);
  return { triggerAction, openAssistant };
};

/**
 * The message body for a SQL debugging action.
 *
 * Composing the prompt here rather than at each call site keeps the phrasing the
 * assistant is tuned for in one place.
 */
export const buildDebugSqlPrompt = (sql: string, error?: string): string =>
  [
    '**Debug this SQL query**',
    '',
    '```sql',
    sql.trim(),
    '```',
    ...(error?.trim() ? ['', '**Error:**', error.trim()] : []),
  ].join('\n');

/** The message body for a SQL optimisation action. */
export const buildOptimizeSqlPrompt = (sql: string): string =>
  ['**Optimise this SQL query**', '', '```sql', sql.trim(), '```'].join('\n');

/** The message body for explaining a chart. */
export const buildExplainChartPrompt = (chartName?: string): string =>
  chartName?.trim()
    ? `Please explain the data shown in "${chartName.trim()}".`
    : 'Please explain the data shown in this chart.';

export default useAIAction;
