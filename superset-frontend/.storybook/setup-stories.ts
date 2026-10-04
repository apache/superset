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

// Source: https://gist.github.com/AriPerkkio/99b9eedc7d8f71ff6e6770f9425a4be4
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { EOL } from 'node:os';
import { fileURLToPath } from 'node:url';
import { type test } from '@playwright/test';

declare global {
  var __storyResult: { status: string; errors: string[] };
}

interface Entry {
  id: string;
  title: string;
  name: string;
  type: 'story' | 'docs';
  tags?: string[];
}

interface Report {
  type: string;
  status: string;
  result?: { violations?: { id: string; help: string }[] };
}

export interface StoryPage {
  addInitScript(script: () => void): Promise<unknown>;
  goto(url: string): Promise<unknown>;
  waitForFunction<T>(
    pageFunction: () => T,
  ): Promise<{ jsonValue(): Promise<T> }>;
}

const storybookURL = process.env.STORYBOOK_URL ?? 'http://localhost:6006';

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexFile = resolve(join(__dirname, './storybook-tests.json'));

export default async function globalSetup() {
  const response = await fetch(`${storybookURL}/index.json`);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${storybookURL}/index.json: ${response.status}`,
    );
  }

  const formattedData = await response.json();

  mkdirSync(dirname(indexFile), { recursive: true });
  writeFileSync(indexFile, JSON.stringify(formattedData, null, 2));
  appendFileSync(indexFile, EOL);
}

function captureStoryResult() {
  const errors: string[] = [];
  const serialize = (error: Error) =>
    error.stack ?? `${error.name}: ${error.message}`;

  let channel: any;
  Object.defineProperty(globalThis, '__STORYBOOK_ADDONS_CHANNEL__', {
    configurable: true,
    get: () => channel,
    set: value => {
      channel = value;
      channel.on(
        'storyErrored',
        ({ title, description }: Record<string, string>) =>
          errors.push(`${title}\n${description}`),
      );
      channel.on('storyThrewException', (error: Error) =>
        errors.push(serialize(error)),
      );
      channel.on('playFunctionThrewException', (error: Error) =>
        errors.push(serialize(error)),
      );
      channel.on('unhandledErrorsWhilePlaying', (unhandled: Error[]) =>
        errors.push(...unhandled.map(serialize)),
      );
      channel.on('storyMissing', (id: string) => {
        globalThis.__storyResult = {
          status: 'missing',
          errors: [`Story "${id}" not found`],
        };
      });
      channel.on(
        'storyFinished',
        ({ status, reporters }: { status: string; reporters: Report[] }) => {
          for (const report of reporters.filter(
            report => report.status === 'failed',
          )) {
            const violations = report.result?.violations ?? [];
            errors.push(
              [
                `${report.type} report failed`,
                ...violations.map(v => `- ${v.id}: ${v.help}`),
              ].join('\n'),
            );
          }
          globalThis.__storyResult = { status, errors };
        },
      );
    },
  });
}

export async function visitStory(page: StoryPage, entry: Entry) {
  await page.addInitScript(captureStoryResult);
  await page.goto(`/iframe.html?id=${entry.id}&viewMode=story`);

  const handle = await page.waitForFunction(() => globalThis.__storyResult);
  const result = await handle.jsonValue();

  if (result.status !== 'success' || result.errors.length > 0) {
    throw new Error(
      [
        `Story "${entry.title} › ${entry.name}" ${result.status === 'missing' ? 'is missing' : 'failed'}.`,
        `Open it in Storybook: ${storybookURL}/?path=/story/${entry.id}`,
        '',
        ...result.errors,
      ].join('\n'),
    );
  }
}

export function loadStories(): [string, Parameters<typeof test>[2]][] {
  if (!existsSync(indexFile)) {
    console.error(`\x1B[41m
Cannot find index.json containing data about Storybook-generated tests
Please run \`npm run test-storybook\` to initialize\x1B[0m
`);
    process.exit(1);
  }

  const index = JSON.parse(readFileSync(indexFile, 'utf8')) as {
    entries: Record<string, Entry>;
  };

  return Object.values(index.entries)
    .filter(entry => entry.type === 'story' && entry.tags?.includes('test'))
    .map(entry => [
      `${entry.title} › ${entry.name}`,
      async ({ page }) => visitStory(page, entry),
    ]);
}
