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
import { useEffect } from 'react';
import { ResultTypes } from './types';

/**
 * A mixed chart can be reconfigured to return fewer result panes than before
 * (e.g. dropping a query), which removes the corresponding results tab. If the
 * selected tab was one of those, the active key goes stale and the data panel
 * renders blank until the user reselects a valid tab. Returns the first
 * results tab to fall back to in that case, otherwise undefined.
 */
export const getStaleResultsTabFallback = (
  activeTabKey: string,
  resultsTabKeys: string[],
): string | undefined =>
  activeTabKey.startsWith(ResultTypes.Results) &&
  !resultsTabKeys.includes(activeTabKey)
    ? ResultTypes.Results
    : undefined;

/**
 * Switches the active tab back to the first results tab when it goes stale,
 * per `getStaleResultsTabFallback`.
 */
export const useStaleResultsTabFallback = (
  activeTabKey: string,
  tabKeys: string[],
  setActiveTabKey: (key: string) => void,
) => {
  const fallback = getStaleResultsTabFallback(activeTabKey, tabKeys);

  useEffect(() => {
    if (fallback) {
      setActiveTabKey(fallback);
    }
  }, [fallback, setActiveTabKey]);
};
