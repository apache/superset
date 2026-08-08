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
import { CompatibilityResult, ExplorePageState } from 'src/explore/types';

const IDLE: CompatibilityResult = { status: 'idle' };

/**
 * The discriminated result of the latest compatibility request; `idle` when
 * no request has run in this Explore session.
 */
export const selectCompatibility = (
  state: ExplorePageState,
): CompatibilityResult => state.explore?.compatibility ?? IDLE;

/**
 * Metric names verified as compatible with the current selection, or `null`
 * when no filtering should be applied (idle, loading, or failed requests
 * deliberately fall back to unfiltered options so the user is never
 * blocked). A verified empty array is a valid "nothing is compatible"
 * result, not a fallback.
 */
export const selectCompatibleMetricNames = (
  state: ExplorePageState,
): string[] | null => {
  const compatibility = selectCompatibility(state);
  return compatibility.status === 'verified' ? compatibility.metrics : null;
};

/**
 * Dimension names verified as compatible with the current selection, or
 * `null` when no filtering should be applied. See
 * `selectCompatibleMetricNames` for the fallback semantics.
 */
export const selectCompatibleDimensionNames = (
  state: ExplorePageState,
): string[] | null => {
  const compatibility = selectCompatibility(state);
  return compatibility.status === 'verified' ? compatibility.dimensions : null;
};
