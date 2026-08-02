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
import { ChatApiError, fetchChatConfig, sendChat } from './client';

function installFetch(
  handler: (url: string, init?: RequestInit) => unknown,
): jest.Mock {
  const mock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(String(input), init),
  );
  Object.defineProperty(globalThis, 'fetch', {
    writable: true,
    configurable: true,
    value: mock,
  });
  return mock;
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

test('fetchChatConfig unwraps the result envelope', async () => {
  installFetch(() => jsonResponse({ result: { enabled: true } }));
  const config = await fetchChatConfig();
  expect(config).toEqual({ enabled: true });
});

test('sendChat attaches the CSRF token and JSON body', async () => {
  const mock = installFetch(() =>
    jsonResponse({ result: { conversation_id: 'c', events: [] } }),
  );
  await sendChat({
    conversation_id: 'conv_test_123',
    messages: [{ role: 'user', content: 'hi' }],
  });
  const [url, init] = mock.mock.calls[0];
  expect(url).toBe('/api/v1/ai_chat/chat');
  expect(init?.method).toBe('POST');
  expect(init?.credentials).toBe('same-origin');
  const headers = init?.headers as Record<string, string>;
  expect(headers['X-CSRFToken']).toBe('test-csrf-token');
  expect(headers['Content-Type']).toBe('application/json');
  expect(JSON.parse(String(init?.body))).toMatchObject({
    conversation_id: 'conv_test_123',
  });
});

test('errors carry the gateway message and error code', async () => {
  installFetch(() =>
    jsonResponse(
      { message: 'AI chat is disabled', error_code: 'AI_CHAT_DISABLED' },
      404,
    ),
  );
  await expect(
    sendChat({ conversation_id: 'conv_test_123', messages: [] }),
  ).rejects.toMatchObject({
    name: 'ChatApiError',
    status: 404,
    errorCode: 'AI_CHAT_DISABLED',
    message: 'AI chat is disabled',
  });
});

test('non-JSON error bodies produce a generic message', async () => {
  installFetch(() => ({
    ok: false,
    status: 502,
    json: async () => {
      throw new Error('not json');
    },
  }));
  await expect(
    sendChat({ conversation_id: 'conv_test_123', messages: [] }),
  ).rejects.toMatchObject({ status: 502 });
  await expect(
    sendChat({ conversation_id: 'conv_test_123', messages: [] }),
  ).rejects.toBeInstanceOf(ChatApiError);
});
