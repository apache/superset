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

import { chat } from 'src/core/chat';
import {
  AI_ACTION_EVENT,
  buildDebugSqlPrompt,
  buildExplainChartPrompt,
  buildOptimizeSqlPrompt,
  triggerAIAction,
} from './useAIAction';
import type { AIActionPayload } from '../types';

const listen = (): AIActionPayload[] => {
  const received: AIActionPayload[] = [];
  window.addEventListener(AI_ACTION_EVENT, event => {
    received.push((event as CustomEvent<AIActionPayload>).detail);
  });
  return received;
};

test('an action opens the assistant and then dispatches its prompt', () => {
  const open = jest.spyOn(chat, 'open').mockImplementation(() => {});
  const received = listen();

  triggerAIAction({ prompt: 'Debug this query', systemPrompt: 'Be terse' });

  // Opening first is what mounts the panel, so its listener exists by the time
  // the event is dispatched.
  expect(open).toHaveBeenCalled();
  expect(received).toEqual([
    { prompt: 'Debug this query', systemPrompt: 'Be terse' },
  ]);
  open.mockRestore();
});

test('an empty prompt is not dispatched', () => {
  const open = jest.spyOn(chat, 'open').mockImplementation(() => {});
  const received = listen();

  triggerAIAction({ prompt: '   ' });

  // Opening the panel with an empty question would start a run with nothing in it.
  expect(open).not.toHaveBeenCalled();
  expect(received).toHaveLength(0);
  open.mockRestore();
});

test('the debug prompt fences the SQL and names the error', () => {
  const prompt = buildDebugSqlPrompt('SELECT 1', 'table not found');

  expect(prompt).toContain('```sql\nSELECT 1\n```');
  expect(prompt).toContain('table not found');
});

test('the debug prompt omits the error section when there is none', () => {
  expect(buildDebugSqlPrompt('SELECT 1')).not.toContain('**Error:**');
});

test('the optimise prompt fences the SQL', () => {
  expect(buildOptimizeSqlPrompt('SELECT 1')).toContain('```sql\nSELECT 1\n```');
});

test('the explain prompt names the chart when it has a name', () => {
  expect(buildExplainChartPrompt('Revenue')).toContain('"Revenue"');
  expect(buildExplainChartPrompt()).toContain('this chart');
});
