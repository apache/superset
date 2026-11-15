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
 * single-use link to an artifact version, its grant, and the manifest the
 * frame host checks requests against.
 */

import type {
  ArtifactManifest,
  Capability,
} from '@apache-superset/artifact-sdk';
import { API_BASE_PATH, DRAFT_TOKEN_HEADER } from '../constants';
import { requestJson } from '../http';

/** A publish request that waits for the user (DR-12). */
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
  /** Whether the viewer owns the artifact, and so may edit it. */
  can_edit: boolean;
  capabilities: Capability[];
  manifest: HostManifest;
  /** Canvas links only: for owners, the publish request waiting for them. */
  pending_publish?: PendingPublish | null;
}

interface Result<T> {
  result: T;
}

/** A link for the artifact a canvas placement shows. */
export async function fetchPlacementFrame({
  canvasId,
  placementId,
  draftToken,
  draft = false,
}: {
  canvasId: number;
  placementId: string;
  draftToken?: string;
  /** The owner's draft of the artifact rather than its published version. */
  draft?: boolean;
}): Promise<FrameLink> {
  const { result } = await requestJson<Result<FrameLink>>(
    `${API_BASE_PATH}/frames/`,
    {
      method: 'POST',
      body: { canvas_id: canvasId, placement_id: placementId, draft },
      headers: draftToken ? { [DRAFT_TOKEN_HEADER]: draftToken } : {},
    },
  );
  return result;
}

/** A link for a standalone artifact page (E9). */
export async function fetchStandaloneFrame(
  artifactId: string,
): Promise<FrameLink> {
  const { result } = await requestJson<Result<FrameLink>>(
    `${API_BASE_PATH}/embedded/artifact/${encodeURIComponent(artifactId)}`,
  );
  return result;
}
