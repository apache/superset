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

import prettyMs from 'pretty-ms';

/**
 * Maximum ETA to display (24 hours in seconds).
 * ETAs beyond this are not shown as they're unreliable.
 */
const MAX_ETA_SECONDS = 86400;

/**
 * Format a duration in seconds to a human-readable string.
 *
 * @param seconds - Duration in seconds
 * @returns Formatted string like "1m 30s" or "2h 15m", or null if invalid
 */
export function formatDuration(
  seconds: number | null | undefined,
): string | null {
  if (seconds === null || seconds === undefined || seconds <= 0) {
    return null;
  }

  return prettyMs(seconds * 1000, {
    unitCount: 2,
    secondsDecimalDigits: 0,
    keepDecimalsOnWholeSeconds: false,
  });
}

/**
 * Calculate and format estimated time to completion based on progress and elapsed time.
 *
 * Uses the formula: ETA = (elapsed / progress) * (1 - progress)
 * For example, if 30% done in 60s, remaining = (60/0.3) * 0.7 = 140s
 *
 * @param progressPercent - Progress as a fraction (0.0 to 1.0)
 * @param durationSeconds - Time elapsed so far in seconds
 * @returns Formatted ETA string or null if cannot be calculated
 */
export function calculateEta(
  progressPercent: number | null | undefined,
  durationSeconds: number | null | undefined,
): string | null {
  // Need both progress and duration to calculate ETA
  if (
    progressPercent === null ||
    progressPercent === undefined ||
    durationSeconds === null ||
    durationSeconds === undefined
  ) {
    return null;
  }

  // Can't calculate ETA if no progress yet or already complete
  if (progressPercent <= 0 || progressPercent >= 1) {
    return null;
  }

  // ETA = (elapsed / progress) * (1 - progress)
  const estimatedTotalTime = durationSeconds / progressPercent;
  const remainingSeconds = estimatedTotalTime * (1 - progressPercent);

  // Only show ETA if it's reasonable (less than 24 hours)
  if (remainingSeconds <= 0 || remainingSeconds > MAX_ETA_SECONDS) {
    return null;
  }

  // Use unitCount: 2 to show up to 2 units (e.g., "1m 30s" instead of just "1m")
  // Use secondsDecimalDigits: 0 to show whole seconds (e.g., "52s" instead of "52.4s")
  return prettyMs(remainingSeconds * 1000, {
    unitCount: 2,
    secondsDecimalDigits: 0,
  });
}

/**
 * Build a progress display for task status tooltips.
 *
 * Returns an array of lines for proper multiline tooltip rendering:
 * - ["In Progress: 9 of 60 (15%)", "ETA: 51s"]
 * - ["In Progress: 42 processed"]
 * - ["In Progress: 50%"]
 * - ["In Progress: 50%", "ETA: 2m"]
 *
 * @param label - Status label (e.g., "In Progress", "Aborting")
 * @param progressCurrent - Current count of items processed
 * @param progressTotal - Total count of items to process
 * @param progressPercent - Progress as a fraction (0.0 to 1.0)
 * @param durationSeconds - Time elapsed so far in seconds (used for ETA calculation)
 * @returns Array of lines for tooltip display
 */
export function formatProgressTooltip(
  label: string,
  progressCurrent?: number | null,
  progressTotal?: number | null,
  progressPercent?: number | null,
  durationSeconds?: number | null,
): string[] {
  const lines: string[] = [];
  let progressPart = '';

  // Build progress part
  if (progressCurrent !== null && progressCurrent !== undefined) {
    if (progressTotal !== null && progressTotal !== undefined) {
      // Count and total with percentage: "3 of 278 (15%)"
      progressPart = `${progressCurrent} of ${progressTotal}`;
      if (progressPercent !== null && progressPercent !== undefined) {
        progressPart += ` (${Math.round(progressPercent * 100)}%)`;
      }
    } else {
      // Count only: "3 processed"
      progressPart = `${progressCurrent} processed`;
    }
  } else if (progressPercent !== null && progressPercent !== undefined) {
    // Percentage only: "50%"
    progressPart = `${Math.round(progressPercent * 100)}%`;
  }

  // Add the main progress line
  if (progressPart) {
    lines.push(`${label}: ${progressPart}`);
  } else {
    lines.push(label);
  }

  // Add ETA on a separate line if available
  const eta = calculateEta(progressPercent, durationSeconds);
  if (eta) {
    lines.push(`ETA: ${eta}`);
  }

  return lines;
}
