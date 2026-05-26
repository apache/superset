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
 * Mock streaming reply used to validate stream teardown semantics.
 *
 * The reference chatbot is environment-validation only — there is no LLM.
 * This iterator yields canned tokens on a timer and exits cleanly when its
 * AbortSignal is fired. Disposal of the extension aborts any in-flight
 * controller, which is the contract that proves async cancellation works.
 */

const TICK_MS = 40;

const buildReply = (prompt: string): string => {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return 'Reference chatbot online. Send a message to validate streaming.';
  }
  return (
    `[reference-chatbot] received "${trimmed}". ` +
    'Streaming token-by-token to validate cancellation and teardown.'
  );
};

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });

export async function* streamReply(
  prompt: string,
  signal: AbortSignal,
): AsyncIterableIterator<string> {
  const tokens = buildReply(prompt).split(/(\s+)/);
  for (const token of tokens) {
    if (signal.aborted) return;
    try {
      await sleep(TICK_MS, signal);
    } catch {
      return;
    }
    yield token;
  }
}
