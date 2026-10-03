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
import { useEffect, useState } from 'react';
import { useCurrentTime } from 'src/dashboard/hooks/useCurrentTime';
import { formatDuration } from 'src/features/tasks/timeUtils';

export interface LiveDurationProps {
  durationSeconds: number | null;
  /**
   * When true (realtime push active AND the task is still running), the value
   * ticks upward once per second. When false, the server value renders
   * statically and refreshes on the next poll/fetch.
   */
  live: boolean;
  locale?: string;
}

/**
 * Renders a task's duration.
 *
 * The live value is anchored on the server-supplied `durationSeconds` plus
 * locally-measured elapsed time (`now - anchoredAt`), so it never parses an
 * absolute server timestamp and is therefore timezone-invariant. The anchor
 * re-bases whenever `durationSeconds` changes (e.g. a realtime nudge patches
 * the row), so ticking resumes from the fresh server value.
 */
const LiveDuration = ({ durationSeconds, live, locale }: LiveDurationProps) => {
  // A fresh server value also restarts the tick in phase with it.
  const now = useCurrentTime(live, durationSeconds);
  const [anchoredAt, setAnchoredAt] = useState(now);
  useEffect(() => setAnchoredAt(Date.now()), [durationSeconds]);

  if (!live || durationSeconds == null) {
    return <>{formatDuration(durationSeconds, locale) ?? '-'}</>;
  }

  const elapsed = durationSeconds + Math.max(0, now - anchoredAt) / 1000;
  return <>{formatDuration(elapsed, locale) ?? '-'}</>;
};

export default LiveDuration;
