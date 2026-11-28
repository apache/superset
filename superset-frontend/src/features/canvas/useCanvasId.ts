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

export type CanvasIdState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'complete'; id: number };

const isId = (idOrSlug: string) => /^\d+$/.test(idOrSlug);

/** Resolves the `/canvas/<id or slug>/` route parameter to a canvas id. */
export function useCanvasId(idOrSlug: string): CanvasIdState {
  const [slugState, setSlugState] = useState<CanvasIdState>({
    status: 'loading',
  });

  useEffect(() => {
    if (isId(idOrSlug)) return undefined;
    let active = true;
    setSlugState({ status: 'loading' });
    const query = rison.encode({
      filters: [{ col: 'slug', opr: 'eq', value: idOrSlug }],
      columns: ['id'],
    });
    SupersetClient.get({ endpoint: `/api/v1/canvas/?q=${query}` })
      .then(({ json }) => {
        if (!active) return;
        const [match] = (json?.result ?? []) as { id: number }[];
        setSlugState(
          match ? { status: 'complete', id: match.id } : { status: 'error' },
        );
      })
      .catch(() => {
        if (active) setSlugState({ status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [idOrSlug]);

  return isId(idOrSlug)
    ? { status: 'complete', id: Number(idOrSlug) }
    : slugState;
}
