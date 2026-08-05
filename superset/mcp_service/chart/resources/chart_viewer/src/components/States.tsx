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
import type { JSX } from 'react';

/** Animated loading skeleton mimicking a chart while data arrives. */
export function LoadingSkeleton(): JSX.Element {
  return (
    <div className="sv-skeleton" role="status" aria-label="Loading chart">
      <div className="sv-sk-line" style={{ width: '40%', height: 14 }} />
      <div className="sv-sk-line" style={{ width: '24%', height: 10 }} />
      <div className="sv-sk-bars">
        {[62, 88, 47, 74, 95, 58, 80, 40].map((h, i) => (
          <div className="sv-sk-bar" key={i} style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

function BarsIcon(): JSX.Element {
  return (
    <svg className="sv-state-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20V10M10 20V4M16 20v-7M22 20H2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlertIcon(): JSX.Element {
  return (
    <svg className="sv-state-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EmptyState({ message }: { message?: string }): JSX.Element {
  return (
    <div className="sv-state" role="status">
      <BarsIcon />
      <div className="sv-state-title">No data to display</div>
      <div className="sv-state-msg">
        {message ?? 'This chart returned no rows. Try adjusting filters or the time range.'}
      </div>
    </div>
  );
}

export function ErrorState({ message }: { message?: string }): JSX.Element {
  return (
    <div className="sv-state sv-state--error" role="alert">
      <AlertIcon />
      <div className="sv-state-title">Could not render chart</div>
      <div className="sv-state-msg">{message ?? 'An unexpected error occurred.'}</div>
    </div>
  );
}
