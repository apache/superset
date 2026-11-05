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
import { SupersetClient } from '@superset-ui/core';
import type { VersionMeta } from 'src/features/versionHistory/types';
import type { CanvasVersionSnapshot } from '../types';

const versionsEndpoint = (canvasUuid: string) =>
  `/api/v1/canvas/${encodeURIComponent(canvasUuid)}/versions/`;

/** A canvas' saves, oldest first. Only its editors can read them. */
export async function fetchCanvasVersions(
  canvasUuid: string,
): Promise<VersionMeta[]> {
  const { json } = await SupersetClient.get({
    endpoint: versionsEndpoint(canvasUuid),
  });
  return json.result;
}

export async function fetchCanvasVersion(
  canvasUuid: string,
  versionUuid: string,
): Promise<CanvasVersionSnapshot> {
  const { json } = await SupersetClient.get({
    endpoint: `${versionsEndpoint(canvasUuid)}${encodeURIComponent(versionUuid)}/`,
  });
  return json.result;
}

export interface RestoreResult {
  revision: number;
  /** Placements left out because their widget is gone or not placeable. */
  skippedPlacements: string[];
}

export async function restoreCanvasVersion(
  canvasUuid: string,
  versionUuid: string,
): Promise<RestoreResult> {
  const { json } = await SupersetClient.post({
    endpoint: `${versionsEndpoint(canvasUuid)}${encodeURIComponent(versionUuid)}/restore`,
  });
  return json.result;
}
