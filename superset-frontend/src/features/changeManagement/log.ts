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
 * A running account of the review workflow, for reading after something
 * went wrong.
 *
 * Every line carries the state the decision was made on, not just the fact
 * that it happened: which request, what status, who the viewer is, whether
 * the page thinks there are unsaved edits. Most of the confusion in this
 * feature has come from two components holding different answers to the
 * same question, and that is invisible unless both answers are written
 * down at the moment they are used.
 *
 * Numbered, so an out-of-order or missing step is obvious, and stamped with
 * milliseconds since the page loaded, because several of the faults here
 * are races measured in a single tick.
 *
 * On by default while this is being worked on. Turn it off in the console
 * with `localStorage.setItem('assetApprovalLog', 'off')` and on again with
 * `localStorage.removeItem('assetApprovalLog')`.
 */

const PREFIX = '[review]';

let sequence = 0;

function enabled(): boolean {
  try {
    return window.localStorage.getItem('assetApprovalLog') !== 'off';
  } catch {
    // Private windows and blocked storage throw rather than return null.
    return true;
  }
}

/** Milliseconds since the page loaded, for spotting same-tick races. */
function since(): string {
  return `${Math.round(performance.now())}ms`;
}

/**
 * Record one step of the workflow.
 *
 * `event` reads as a sentence in the log, so prefer "save: captured for
 * review" over "SAVE_CAPTURED". `detail` is the state that mattered.
 */
export function reviewLog(
  event: string,
  detail?: Record<string, unknown>,
): void {
  if (!enabled()) return;
  sequence += 1;
  const head = `${PREFIX} #${sequence} ${since()} ${event}`;
  // One self-contained line of plain text, detail and all.
  //
  // Deliberately not `console.log(message, object)`: the console renders
  // that second argument as a collapsed "Object", and a log whose contents
  // only exist behind a disclosure triangle is no use to somebody copying
  // the output into a bug report. Styling is left off for the same reason
  // -- a `%c` directive survives the copy and the colour does not.
  let line = head;
  if (detail && Object.keys(detail).length) {
    try {
      line = `${head} ${JSON.stringify(detail)}`;
    } catch {
      line = `${head} (detail could not be serialised)`;
    }
  }
  // eslint-disable-next-line no-console
  console.log(line);
}

/**
 * The fields worth having on nearly every line.
 *
 * Kept in one place so each call site does not pick its own subset and
 * leave out the one that would have explained the fault.
 */
export function requestFacts(
  request: {
    id?: number;
    status?: string;
    is_open?: boolean;
    is_author?: boolean;
    asset_type?: string;
    asset_id?: number;
  } | null,
): Record<string, unknown> {
  if (!request) return { request: null };
  return {
    requestId: request.id,
    status: request.status,
    isOpen: request.is_open,
    isAuthor: request.is_author,
    asset: `${request.asset_type} ${request.asset_id}`,
  };
}
