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
import { t } from '@apache-superset/core/translation';

/** A property that tile features carry, as listed in TileJSON. */
export interface TileProperty {
  name: string;
  /** Type as reported by the server (e.g. "int4", "text"); servers vary. */
  type?: string;
}

type VectorLayer = { id?: unknown; fields?: Record<string, unknown> };

// Numeric type names as reported by common tile servers: Postgres (Martin)
// and TileJSON/tippecanoe ("Number").
const NUMERIC_TILE_TYPE =
  /^(number|numeric|decimal|real|double( precision)?|float\d*|int\d*|integer|smallint|bigint)$/i;

/** False only when the server reports a non-numeric type; unknown types count as numeric. */
export const isNumericTileType = (type?: string): boolean =>
  type === undefined || NUMERIC_TILE_TYPE.test(type.trim());

/**
 * Lists properties from a TileJSON document's `vector_layers`. Uses only the
 * source layer's fields when one is given, otherwise merges every layer's.
 */
export function getTileJsonProperties(
  tileJson: unknown,
  sourceLayer?: string,
): TileProperty[] {
  const layers = (tileJson as { vector_layers?: unknown } | null)
    ?.vector_layers;
  if (!Array.isArray(layers)) {
    throw new Error(t('the response has no vector_layers'));
  }
  const chosen = sourceLayer
    ? (layers as VectorLayer[]).filter(layer => layer?.id === sourceLayer)
    : (layers as VectorLayer[]);
  if (sourceLayer && chosen.length === 0) {
    throw new Error(t('it has no layer named "%s"', sourceLayer));
  }

  const byName = new Map<string, TileProperty>();
  chosen.forEach(layer => {
    Object.entries(layer?.fields ?? {}).forEach(([name, type]) => {
      if (!byName.has(name)) {
        byName.set(name, {
          name,
          type: typeof type === 'string' ? type : undefined,
        });
      }
    });
  });
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function requestTileJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error(
      t(
        'the server could not be reached, or it does not allow requests from Superset (CORS)',
      ),
    );
  }
  if (!response.ok) {
    throw new Error(t('the server responded with status %s', response.status));
  }
  try {
    return await response.json();
  } catch {
    throw new Error(t('the response is not valid JSON'));
  }
}

const tileJsonRequests = new Map<string, Promise<unknown>>();

/** Fetches a TileJSON document once per URL and shares the result. */
export function fetchTileJson(url: string): Promise<unknown> {
  const cached = tileJsonRequests.get(url);
  if (cached) {
    return cached;
  }
  const request = requestTileJson(url);
  tileJsonRequests.set(url, request);
  // Failed requests are forgotten so a fixed server can be retried.
  request.catch(() => tileJsonRequests.delete(url));
  return request;
}

export interface TileJsonPropertiesState {
  properties: TileProperty[];
  loading: boolean;
  error?: string;
}

const NO_PROPERTIES: TileJsonPropertiesState = {
  properties: [],
  loading: false,
};

/** Loads tile properties from a TileJSON URL; idle when no URL is given. */
export function useTileJsonProperties(
  url?: string,
  sourceLayer?: string,
): TileJsonPropertiesState {
  const [state, setState] = useState<TileJsonPropertiesState>(NO_PROPERTIES);

  useEffect(() => {
    const trimmedUrl = url?.trim();
    if (!trimmedUrl) {
      setState(NO_PROPERTIES);
      return undefined;
    }
    let ignore = false;
    setState({ properties: [], loading: true });
    fetchTileJson(trimmedUrl)
      .then(tileJson =>
        getTileJsonProperties(tileJson, sourceLayer || undefined),
      )
      .then(properties => {
        if (!ignore) {
          setState({ properties, loading: false });
        }
      })
      .catch((error: Error) => {
        if (!ignore) {
          setState({ properties: [], loading: false, error: error.message });
        }
      });
    return () => {
      ignore = true;
    };
  }, [url, sourceLayer]);

  return state;
}
