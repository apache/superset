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

// While held, the dashboard keeps the filter key from the opened link in the
// URL instead of replacing it with a key for the fallback (default) filters.
// The hold ends when the viewer changes a filter; the next publish then creates
// a new key so the opened link's saved state is never overwritten.
let held = false;
let needsNewKey = false;

export const holdFilterKeyPublish = () => {
  held = true;
  needsNewKey = false;
};

export const releaseFilterKeyPublish = () => {
  if (held) needsNewKey = true;
  held = false;
};

export const isFilterKeyPublishHeld = () => held;

/** Returns true once after a release, then resets. */
export const consumeNeedsNewKey = () => {
  const value = needsNewKey;
  needsNewKey = false;
  return value;
};
