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
import fetchMock from 'fetch-mock';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import EmbedCodeContent from 'src/explore/components/EmbedCodeContent';

// The chart-embed iframe `src` is produced by:
//   1. Backend `url_for(_external=True)` → absolute URL whose origin is the
//      backend `Host` header (often the internal docker hostname under
//      `superset-light:8088` when `ENABLE_PROXY_FIX` is off).
//   2. Frontend `rewritePermalinkOrigin` swaps the origin for
//      `window.location.origin` so the iframe `src` is reachable from the
//      browser that pasted the embed code.
//   3. The path segment (`/superset/explore/p/<key>/`) survives unchanged —
//      the application_root must therefore be applied exactly once.
//
// This composition was previously verified only via manual QA
// (memory `project_supersetclient_approot_dedupe` records the discovery).
// This test pins the iframe-src shape so a future change to the permalink
// API, the origin-rewrite helper, or the EmbedCodeContent template would
// surface in CI rather than in a user-reported broken embed.

const SUBDIR_PERMALINK_URL =
  'http://superset-light:8088/superset/explore/p/abc123/';

fetchMock.post('glob:*/api/v1/explore/permalink', {
  url: SUBDIR_PERMALINK_URL,
});

const mockFormData = {
  datasource: 'table__1',
  viz_type: 'table',
};

test('iframe src under subdir deployment uses browser origin + single prefix', async () => {
  render(<EmbedCodeContent formData={mockFormData} />, { useRedux: true });

  // The textarea `value` contains the full iframe HTML once the permalink
  // promise resolves. `data-test="embed-code-textarea"` is the stable hook.
  const textarea = await screen.findByTestId('embed-code-textarea');

  // Wait for the asynchronous permalink fetch to land in the textarea.
  await waitFor(() =>
    expect((textarea as HTMLTextAreaElement).value).toContain('<iframe'),
  );

  const html = (textarea as HTMLTextAreaElement).value;
  const srcMatch = html.match(/src="([^"]+)"/);
  expect(srcMatch).not.toBeNull();
  const src = (srcMatch as RegExpMatchArray)[1];

  // Two contracts: origin is the browser-side origin (jsdom default
  // `http://localhost`), and the `/superset/` prefix from the backend
  // payload survives — exactly once.
  const parsed = new URL(src);
  expect(parsed.origin).toBe(window.location.origin);
  expect(parsed.pathname).toBe('/superset/explore/p/abc123/');
  expect(src).not.toContain('/superset/superset/');
  // Standalone + height controls are appended additively by the component.
  expect(parsed.searchParams.get('standalone')).toBe('1');
  expect(parsed.searchParams.get('height')).toBe('400');
});
