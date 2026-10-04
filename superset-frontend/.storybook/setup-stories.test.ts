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
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { expect, test } from '@playwright/test';
import type { StoryPage } from './setup-stories';
import { visitStory } from './setup-stories';

type Listener = (payload: never) => void;

interface StoryFixture {
  play?: () => Promise<void>;
  throwPlayFunctionExceptions?: boolean;
}

function createPage({
  play,
  throwPlayFunctionExceptions = false,
}: StoryFixture = {}): StoryPage {
  const listeners = new Map<string, Listener>();
  const channel = {
    on: (event: string, listener: Listener) => listeners.set(event, listener),
    emit: (event: string, payload: unknown) =>
      listeners.get(event)?.(payload as never),
  };

  return {
    addInitScript: async script => script(),
    goto: async () => {
      Reflect.set(globalThis, '__STORYBOOK_ADDONS_CHANNEL__', channel);
      let status = 'success';
      try {
        await play?.();
      } catch (error) {
        channel.emit('playFunctionThrewException', error);
        if (throwPlayFunctionExceptions) {
          status = 'error';
        }
      }
      channel.emit('storyFinished', { status, reporters: [] });
    },
    waitForFunction: async pageFunction => ({
      jsonValue: async () => pageFunction(),
    }),
  };
}

const entry = {
  id: 'runner-fixture--story',
  title: 'Runner fixture',
  name: 'Story',
  type: 'story' as const,
};

test.afterEach(() => {
  Reflect.deleteProperty(globalThis, '__STORYBOOK_ADDONS_CHANNEL__');
  Reflect.deleteProperty(globalThis, '__storyResult');
});

test('fails when throwPlayFunctionExceptions is false and the play function throws', async () => {
  const sentinelError = new Error('Sentinel play-function error');

  await expect(
    visitStory(
      createPage({
        play: async () => {
          throw sentinelError;
        },
        throwPlayFunctionExceptions: false,
      }),
      entry,
    ),
  ).rejects.toThrow('Sentinel play-function error');
});

test('passes when the story completes without errors', async () => {
  await expect(visitStory(createPage(), entry)).resolves.toBeUndefined();
});
