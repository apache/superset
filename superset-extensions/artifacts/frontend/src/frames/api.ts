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
 * @fileoverview Frame links from the backend: the provider's short-lived,
 * single-use link to an artifact version, its grant, the limits of the
 * frame's requests, and the manifest the frame host checks them against.
 */

import type {
  ArtifactManifest,
  BridgeLimits,
  Capability,
} from '@superset-oss/artifacts-sdk';
import { API_BASE_PATH, DRAFT_TOKEN_HEADER } from '../constants';
import { RequestError, RequestOptions, requestJson } from '../http';

/** A publish request that waits for the user. */
export interface PendingPublish {
  request_id: string;
  version: string;
  requested_at: string;
  expires_at: string;
}

/** The parts of the manifest that the frame host checks requests against. */
export type HostManifest = Pick<
  ArtifactManifest,
  'title' | 'bindings' | 'events' | 'capabilities'
>;

export interface FrameLink {
  url: string;
  expires_at: string;
  artifact_id: string;
  version: string;
  is_draft: boolean;
  /** Whether the viewer is one of the artifact's editors. */
  can_edit: boolean;
  capabilities: Capability[];
  /** What the frame host holds the frame's requests to. */
  limits: Partial<BridgeLimits>;
  manifest: HostManifest;
  /** For editors: the publish request waiting for them. */
  pending_publish?: PendingPublish | null;
}

interface Result<T> {
  result: T;
}

/**
 * Ask for a frame link, and once more when the version it names is gone
 * (`VERSION_NOT_FOUND`), as when a publish lands between the server reading
 * the version and the provider minting the link: the second request reads
 * the version again.
 */
async function requestLink(
  path: string,
  options?: RequestOptions,
): Promise<FrameLink> {
  const request = async () =>
    (await requestJson<Result<FrameLink>>(path, options)).result;
  try {
    return await request();
  } catch (reason) {
    if (reason instanceof RequestError && reason.code === 'VERSION_NOT_FOUND') {
      return request();
    }
    throw reason;
  }
}

/** A link for an artifact that a canvas placement shows. */
export async function fetchPlacementFrame({
  widgetId,
  canvasId,
  placementId,
  draftToken,
}: {
  /** The artifact: its saved widget's UUID. */
  widgetId: string;
  canvasId: number;
  placementId: string;
  /** The canvas draft the page shows, if any: its editors see the draft. */
  draftToken?: string;
}): Promise<FrameLink> {
  return requestLink(`${API_BASE_PATH}/frames/`, {
    method: 'POST',
    body: {
      widget_id: widgetId,
      canvas_id: canvasId,
      placement_id: placementId,
    },
    headers: draftToken ? { [DRAFT_TOKEN_HEADER]: draftToken } : {},
  });
}

/** A link for an artifact on a page of its own. */
export async function fetchPageFrame(
  widgetId: string,
  page: 'standalone' | 'embedded' = 'standalone',
): Promise<FrameLink> {
  return requestLink(`${API_BASE_PATH}/frames/`, {
    method: 'POST',
    body: { widget_id: widgetId, page },
  });
}
