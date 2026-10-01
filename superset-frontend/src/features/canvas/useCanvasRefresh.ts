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
import { CanvasDefinition } from './types';

/**
 * Drives the canvas' automatic refresh: every `settings.refresh.interval`
 * seconds, each node not exempt gets its refresh key bumped, spread over
 * `stagger` milliseconds in reading order. Widgets refetch when their key
 * changes.
 */
export function useCanvasRefresh(
  definition: CanvasDefinition | undefined,
): Record<string, number> {
  const [keys, setKeys] = useState<Record<string, number>>({});
  const refresh = definition?.settings.refresh;
  const interval = refresh?.interval ?? 0;
  const stagger = refresh?.stagger ?? 0;
  const exempt = new Set(refresh?.exempt ?? []);
  const targetsKey = definition
    ? Object.keys(definition.nodes)
        .filter(nodeId => !exempt.has(nodeId))
        .join(',')
    : '';

  useEffect(() => {
    if (interval <= 0 || !targetsKey) return undefined;
    const targets = targetsKey.split(',');
    const pending = new Set<ReturnType<typeof setTimeout>>();
    const bump = (nodeId: string) =>
      setKeys(previous => ({
        ...previous,
        [nodeId]: (previous[nodeId] ?? 0) + 1,
      }));
    const timer = setInterval(() => {
      targets.forEach((nodeId, index) => {
        const delay = Math.round((stagger * index) / targets.length);
        if (delay === 0) {
          bump(nodeId);
          return;
        }
        const timeout = setTimeout(() => {
          pending.delete(timeout);
          bump(nodeId);
        }, delay);
        pending.add(timeout);
      });
    }, interval * 1000);
    return () => {
      clearInterval(timer);
      pending.forEach(clearTimeout);
    };
  }, [interval, stagger, targetsKey]);

  return keys;
}
