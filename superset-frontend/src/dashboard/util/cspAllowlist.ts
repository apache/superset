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
import { SupersetClient } from '@superset-ui/core';

export const CSP_ALLOWLIST_ENDPOINT = '/api/v1/csp_allowlist/';
export const DEFAULT_EMBED_DIRECTIVE = 'frame-src';

/** FAB requires `can write on CSPAllowlist`; Admins hold it by default. */
export const CSP_ALLOWLIST_PERMISSION = 'can_write';
export const CSP_ALLOWLIST_VIEW = 'CSPAllowlist';

interface CSPAllowlistResult {
  result?: { domain: string; directive: string }[];
}

/**
 * Return the bare origin (scheme://host[:port]) of a URL, or null if the URL is
 * empty or cannot be parsed. Mirrors the server-side `is_valid_csp_origin`
 * canonicalization so the UX check matches what the backend will accept.
 */
export function getOrigin(url?: string | null): string | null {
  if (!url) {
    return null;
  }
  try {
    const { origin } = new URL(url);
    // URL parses things like "mailto:" to an opaque origin of "null"
    return origin && origin !== 'null' ? origin : null;
  } catch {
    return null;
  }
}

/** True only for absolute http(s) URLs that resolve to a concrete origin. */
export function isEmbeddableUrl(url?: string | null): boolean {
  const origin = getOrigin(url);
  return !!origin && /^https?:\/\//.test(origin);
}

/** Fetch the set of origins currently allowed for the given CSP directive. */
export async function fetchCspAllowlist(
  directive: string = DEFAULT_EMBED_DIRECTIVE,
): Promise<Set<string>> {
  const response = await SupersetClient.get({
    endpoint: CSP_ALLOWLIST_ENDPOINT,
  });
  const json = response.json as CSPAllowlistResult;
  const origins = (json.result ?? [])
    .filter(entry => entry.directive === directive)
    .map(entry => entry.domain);
  return new Set(origins);
}

/** Add a new allowlist entry (punch a hole in the CSP) for the given origin. */
export async function addCspAllowlistEntry(
  domain: string,
  directive: string = DEFAULT_EMBED_DIRECTIVE,
): Promise<void> {
  await SupersetClient.post({
    endpoint: CSP_ALLOWLIST_ENDPOINT,
    jsonPayload: { domain, directive },
  });
}
