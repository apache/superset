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
import { t } from '@apache-superset/core/translation';

export type GuestTokenSize = {
  tokenBytes: number;
  headerBytes: number;
  headerBudgetBytes: number | null;
  headerBudgetExceeded: boolean;
};

/** Measure the encoded token without decoding or retaining credentials. */
export function measureGuestToken(
  token: string,
  headerName = 'X-GuestToken',
  budget?: unknown,
): GuestTokenSize {
  const encoder = new TextEncoder();
  const tokenBytes = encoder.encode(token).length;
  // HTTP/1-style accounting: name + ": " + value + CRLF, not wire compression.
  const headerBytes = tokenBytes + encoder.encode(headerName).length + 4;
  const headerBudgetBytes =
    typeof budget === 'number' && Number.isSafeInteger(budget) && budget > 0
      ? budget
      : null;
  return {
    tokenBytes,
    headerBytes,
    headerBudgetBytes,
    headerBudgetExceeded:
      headerBudgetBytes !== null && headerBytes > headerBudgetBytes,
  };
}

/** Diagnose from size evidence only; never inspect or log proxy response bodies. */
export function guestAuthenticationMessage(
  size?: GuestTokenSize,
  error?: unknown,
): string {
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? error.status
      : undefined;
  // Explicit auth/server failures have other causes. Some non-JSON proxy
  // failures lose their status during parsing, so size remains the evidence.
  const possibleHeaderFailure =
    status === undefined || status === 400 || status === 431 || status === 494;
  return size?.headerBudgetExceeded && possibleHeaderFailure
    ? t(
        'Embedded authentication failed. The guest token may exceed the request-header size limit. Reduce the token payload; large inline RLS lists can be replaced with an entitlements-table lookup.',
      )
    : t(
        'Something went wrong with embedded authentication. Check the dev console for details.',
      );
}
