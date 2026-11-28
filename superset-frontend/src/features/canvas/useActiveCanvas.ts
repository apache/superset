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
import type { canvas as canvasApi } from '@apache-superset/core';
import { setActiveCanvas } from 'src/core';

export interface ActiveCanvasInput {
  id: number;
  title: string;
  /** Revision of the definition the page has loaded. */
  revision: number;
  /** The draft token in the page URL, if any. */
  draftToken?: string;
  /**
   * Whether that draft's own definition has loaded for this canvas, and the
   * draft has not since turned out to be gone.
   */
  draftLoaded: boolean;
  /** The revision the draft's layout writes have reached. */
  draftRevision: number;
  /**
   * Whether a change to the draft is in flight or not yet on screen, or its
   * last refresh failed.
   */
  draftPending: boolean;
  /** The saved version shown in place of the canvas, if any. */
  previewedVersion?: canvasApi.ActiveCanvasVersion;
}

const draftOf = (
  token: string,
  pending: boolean,
  revision: number,
): canvasApi.ActiveCanvasDraft =>
  Object.freeze(
    pending
      ? { token, pending: true as const }
      : { token, pending: false as const, revision },
  );

/**
 * What extensions are told about the open canvas. The draft is named only
 * once its own definition is on screen, and its revision only while nothing
 * is moving it, so an extension that publishes it publishes what the user
 * saw.
 */
export const activeCanvasOf = ({
  id,
  title,
  revision,
  draftToken,
  draftLoaded,
  draftRevision,
  draftPending,
  previewedVersion,
}: ActiveCanvasInput): canvasApi.ActiveCanvas =>
  // Frozen: every listener gets the same object, and the host keeps it.
  Object.freeze({
    id,
    title,
    revision,
    ...(previewedVersion
      ? { previewedVersion: Object.freeze({ ...previewedVersion }) }
      : draftToken && draftLoaded
        ? { draft: draftOf(draftToken, draftPending, draftRevision) }
        : {}),
  });

/**
 * Tells extensions about the open canvas whenever any part of it changes.
 * Nothing is said for an undefined input. There is no cleanup: the page
 * clears the value when the canvas goes away, so remounting the body for a
 * version preview doesn't flash "no canvas" in between.
 */
export function usePublishActiveCanvas(input: ActiveCanvasInput | undefined) {
  const enabled = input !== undefined;
  const {
    id,
    title,
    revision,
    draftToken,
    draftLoaded,
    draftRevision,
    draftPending,
    previewedVersion,
  } = input ?? {};
  const versionUuid = previewedVersion?.uuid;
  const versionNumber = previewedVersion?.number;
  useEffect(() => {
    if (
      !enabled ||
      id === undefined ||
      title === undefined ||
      revision === undefined
    ) {
      return;
    }
    setActiveCanvas(
      activeCanvasOf({
        id,
        title,
        revision,
        draftToken,
        draftLoaded: Boolean(draftLoaded),
        draftRevision: draftRevision ?? revision,
        draftPending: Boolean(draftPending),
        previewedVersion:
          versionUuid === undefined || versionNumber === undefined
            ? undefined
            : { uuid: versionUuid, number: versionNumber },
      }),
    );
  }, [
    enabled,
    id,
    title,
    revision,
    draftToken,
    draftLoaded,
    draftRevision,
    draftPending,
    versionUuid,
    versionNumber,
  ]);
}
