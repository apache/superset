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
import rison from 'rison';
import { SupersetClient } from '@superset-ui/core';
import { Policy, SaveCheckResult } from 'src/utils/timeRangeLimits';

export type SaveCheckState = 'idle' | 'checking' | 'done' | 'failed';

export type SaveCheck = {
  state: SaveCheckState;
  result: SaveCheckResult | null;
  /** The policy `result` was checked with. */
  checkedPolicy: Policy | null;
};

export const SAVE_CHECK_DELAY = 500;

/** Whether the save check warns: no field errors, and charts, filters or unchecked charts to list. */
export function saveCheckWarns(
  saveCheck: SaveCheck | undefined,
  errors: Record<string, string>,
): boolean {
  const result =
    saveCheck && saveCheck.state !== 'idle' && !Object.keys(errors).length
      ? saveCheck.result
      : null;
  return (
    !!result &&
    (result.charts.length > 0 ||
      result.filters.length > 0 ||
      result.unchecked.length > 0)
  );
}

const IDLE: SaveCheck = { state: 'idle', result: null, checkedPolicy: null };

/**
 * Lists the charts and Time Range filter defaults the edited limits would
 * refuse, one request per pause in editing. Only ever informs: nothing waits
 * for it.
 */
export default function useSaveCheck({
  endpoint,
  policy,
  enabled,
}: {
  endpoint: string | null;
  policy: Policy | null;
  enabled: boolean;
}): SaveCheck {
  const [check, setCheck] = useState<SaveCheck>(IDLE);
  const policyKey = JSON.stringify(policy);

  useEffect(() => {
    if (!enabled || !endpoint) {
      setCheck(IDLE);
      return undefined;
    }
    const checkedPolicy: Policy | null = JSON.parse(policyKey);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setCheck(previous => ({ ...previous, state: 'checking' }));
      SupersetClient.get({
        endpoint: `${endpoint}?q=${rison.encode({ policy: checkedPolicy })}`,
        timeout: 10000,
        fetchRetryOptions: { retries: 0 },
        signal: controller.signal,
      })
        .then(({ json }) => {
          if (!controller.signal.aborted) {
            setCheck({
              state: 'done',
              result: (json as { result: SaveCheckResult }).result,
              checkedPolicy,
            });
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setCheck({ state: 'failed', result: null, checkedPolicy });
          }
        });
    }, SAVE_CHECK_DELAY);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, endpoint, policyKey]);

  return check;
}
