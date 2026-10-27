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
 * The hook itself is exercised through the panel; these cover the two decisions
 * that are easy to get wrong and expensive when wrong — what happens to the
 * transcript when the server's copy arrives, and what is sent as page context.
 */

import { buildRequestPageContext, mergeMessages } from './useChatBot';
import type { ChatMessageWithMeta } from '../types';
import type { PageContext } from './usePageContext';

const message = (
  overrides: Partial<ChatMessageWithMeta>,
): ChatMessageWithMeta => ({
  id: 'id',
  role: 'assistant',
  content: 'content',
  timestamp: 0,
  ...overrides,
});

const pageContext: PageContext = {
  url: '/sqllab',
  pathname: '/sqllab',
  pageType: 'sqllab',
};

test('the server transcript replaces the local one turn for turn', () => {
  const merged = mergeMessages(
    [
      message({ id: 'server-user', role: 'user', content: 'ask' }),
      message({ id: 'server-reply', content: 'answer' }),
    ],
    [
      message({ id: 'local-1', role: 'user', content: 'ask', pending: true }),
      message({ id: 'local-1-reply', content: 'answer', pending: true }),
    ],
  );

  // The same two turns, now under their real uuids and with no duplicates.
  expect(merged.map(entry => entry.id)).toEqual([
    'server-user',
    'server-reply',
  ]);
});

test('a turn the server has not recorded yet is kept', () => {
  const merged = mergeMessages(
    [message({ id: 'server-user', role: 'user', content: 'ask' })],
    [
      message({ id: 'local-1', role: 'user', content: 'ask' }),
      message({ id: 'local-1-reply', content: 'the answer just shown' }),
    ],
  );

  // Dropping it would erase an answer the user has already read.
  expect(merged.map(entry => entry.content)).toEqual([
    'ask',
    'the answer just shown',
  ]);
});

test('an empty server transcript does not wipe what is on screen', () => {
  const local = [message({ id: 'local-1', role: 'user', content: 'ask' })];

  expect(mergeMessages([], local)).toEqual(local);
});

test('page context is omitted entirely when the user turns it off', () => {
  expect(buildRequestPageContext(undefined)).toBeUndefined();
});

test('a directive alone still travels, since there is no system-message field', () => {
  expect(buildRequestPageContext(undefined, 'Be terse')).toEqual({
    helper_directives: ['Be terse'],
  });
});

test('a directive is prepended to the page own directives', () => {
  const payload = buildRequestPageContext(
    {
      ...pageContext,
      pageMarkdown: [
        { source: 'chart_description', content: '@helper Weekly' },
      ],
    },
    'Be terse',
  );

  // The caller's directive comes first so it takes precedence when they conflict.
  expect(payload?.helper_directives).toEqual(['Be terse', 'Weekly']);
  expect(payload?.pageType).toBe('sqllab');
});
