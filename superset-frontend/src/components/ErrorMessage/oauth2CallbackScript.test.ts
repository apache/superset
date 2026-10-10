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

import fs from 'fs';
import path from 'path';

// Runs the actual inline script from the OAuth2 popup callback template
// (not a reimplementation of it), so a future edit to the template can't
// silently drift from this regression coverage.
const TEMPLATE_PATH = path.join(
  __dirname,
  '../../../../superset/templates/superset/oauth2.html',
);

function extractCallbackScript(): string {
  const html = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  const match = html.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error('Could not find the callback <script> in oauth2.html');
  }
  return match[1].replace('{{ tab_id }}', 'test-tab-id');
}

function runCallbackScript({
  broadcastChannel,
  setItem,
}: {
  broadcastChannel?: () => BroadcastChannel;
  setItem?: () => void;
}) {
  const script = extractCallbackScript();
  const closeMock = jest.fn();
  const globalWithBroadcastChannel = global as unknown as {
    BroadcastChannel?: () => BroadcastChannel;
  };
  const originalClose = window.close;
  const originalBroadcastChannel = globalWithBroadcastChannel.BroadcastChannel;
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;

  window.close = closeMock;
  if (broadcastChannel) {
    globalWithBroadcastChannel.BroadcastChannel = broadcastChannel;
  } else {
    delete globalWithBroadcastChannel.BroadcastChannel;
  }
  if (setItem) {
    Storage.prototype.setItem = setItem;
  }

  try {
    // eslint-disable-next-line no-new-func
    new Function(script)();
  } finally {
    window.close = originalClose;
    globalWithBroadcastChannel.BroadcastChannel = originalBroadcastChannel;
    Storage.prototype.setItem = originalSetItem;
    Storage.prototype.removeItem = originalRemoveItem;
  }

  return closeMock;
}

test('closes the popup once the storage signal is sent', () => {
  const closeMock = runCallbackScript({});

  expect(closeMock).toHaveBeenCalledTimes(1);
});

test('closes the popup once the BroadcastChannel signal is sent', () => {
  const closeMock = runCallbackScript({
    broadcastChannel: jest.fn().mockImplementation(() => ({
      postMessage: jest.fn(),
      close: jest.fn(),
    })),
    setItem: () => {
      throw new Error('blocked');
    },
  });

  expect(closeMock).toHaveBeenCalledTimes(1);
});

test('leaves the popup open when both channels fail, so the re-run instructions stay visible', () => {
  function BlockedBroadcastChannel(): BroadcastChannel {
    throw new Error('blocked');
  }
  const closeMock = runCallbackScript({
    broadcastChannel:
      BlockedBroadcastChannel as unknown as () => BroadcastChannel,
    setItem: () => {
      throw new Error('blocked');
    },
  });

  expect(closeMock).not.toHaveBeenCalled();
});
