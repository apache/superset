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
 * @fileoverview A dashboard as it would be if a held write were applied.
 *
 * A write that is held back -- accepted by the server but not yet applied --
 * is a field-level request body, not a snapshot: it carries the fields it
 * would change and says nothing about the rest. Drawing it means laying it
 * over the dashboard as it is now, which is what applying it would do, so
 * the picture and the outcome cannot disagree.
 *
 * Only the fields that decide what a viewer sees are laid over. A body can
 * also carry owners, roles and tags, and those are not the same shape as
 * the objects the live dashboard holds under the same names (ids, where the
 * page holds people); writing them across would put a list of integers
 * where the header expects users. They do not change the picture, so they
 * stay as the live dashboard has them.
 */
import type { JsonObject } from '@superset-ui/core';
import type { HydrateDashboardData } from 'src/dashboard/actions/hydrate';

/** Body fields that carry across by name: same meaning, same shape. */
const SCALAR_FIELDS = [
  'dashboard_title',
  'slug',
  'css',
  'description',
  'published',
  'certified_by',
  'certification_details',
] as const;

/**
 * The two body fields that arrive as JSON text and are held parsed by the
 * hydration data, and the name they are held under there.
 */
const PARSED_FIELDS = {
  json_metadata: 'metadata',
  position_json: 'position_data',
} as const;

/** Every body field that changes what is drawn. */
export const DASHBOARD_DRAWING_FIELDS: readonly string[] = [
  ...SCALAR_FIELDS,
  ...Object.keys(PARSED_FIELDS),
  'theme_id',
];

function parseObject(value: unknown): JsonObject | null | undefined {
  if (value === null) return null;
  if (typeof value === 'object') return value as JsonObject;
  if (typeof value !== 'string') return undefined;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as JsonObject) : null;
  } catch {
    return undefined;
  }
}

/** Whether the body carries anything that would change the picture. */
export function hasHeldDashboard(heldFields: JsonObject): boolean {
  return DASHBOARD_DRAWING_FIELDS.some(field => field in heldFields);
}

/**
 * Lay a held body over the live dashboard.
 *
 * Returns `null` when there is nothing to draw: the body changes no visible
 * field, or a field that must be JSON text does not parse. The second is a
 * body that would fail when applied too, and quietly drawing the live
 * dashboard under a label saying it is something else is the mislabelling
 * this exists to avoid.
 *
 * `theme_id` is not resolved here -- the page holds the theme object, not
 * its id, and resolving it is a request. The caller does that and passes the
 * result as `theme`; `undefined` leaves the live theme in place.
 */
export function composeHeldDashboard(
  live: HydrateDashboardData,
  heldFields: JsonObject,
  theme?: HydrateDashboardData['theme'],
): HydrateDashboardData | null {
  if (!hasHeldDashboard(heldFields)) return null;

  const composed: Record<string, unknown> = { ...live };
  SCALAR_FIELDS.forEach(field => {
    if (field in heldFields) composed[field] = heldFields[field];
  });

  let heldPositions: JsonObject | null | undefined;
  const entries = Object.entries(PARSED_FIELDS) as [
    keyof typeof PARSED_FIELDS,
    string,
  ][];
  for (let i = 0; i < entries.length; i += 1) {
    const [field, key] = entries[i];
    if (field in heldFields) {
      const parsed = parseObject(heldFields[field]);
      if (parsed === undefined) return null;
      composed[key] = field === 'json_metadata' ? (parsed ?? {}) : parsed;
      if (field === 'position_json') heldPositions = parsed;
    }
  }

  // The editor posts the grid inside `json_metadata.positions`, while the
  // stored row keeps it in the `position_json` column, so the two sides do
  // not name it the same thing. Reading only `position_json` leaves the live
  // grid in place for a body that moved, resized or removed something, and
  // the only visible change is the title. `position_json` still wins where
  // the body carries it: it says the same thing more directly.
  if (heldPositions === undefined && 'json_metadata' in heldFields) {
    const positions = (composed.metadata as JsonObject | undefined)?.positions;
    if (positions && typeof positions === 'object') {
      composed.position_data = positions;
    }
  }

  if (theme !== undefined) composed.theme = theme;
  return composed as unknown as HydrateDashboardData;
}
