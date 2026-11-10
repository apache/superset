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
 * @fileoverview What Explore says about the held version it was asked to put
 * on screen, and the two places it leaves room for one.
 *
 * `explore.heldVersion.show` (see `exploreCommands.ts`) is a command, so it
 * answers its caller and nothing else. But three things have to agree about a
 * held version once it is up -- the chart column has to make room for it, the
 * controls beside it have to go inert, and whoever is drawing it has to be
 * handed the composed form data -- and only the first two are Explore's own
 * components. So the outcome is announced rather than returned, on one
 * channel, and the command's boolean stays what it always was: whether the
 * version asked for is now on screen.
 *
 * A window event rather than a module export, because the drawing is not
 * necessarily in this bundle. Explore composes the form data, since the live
 * chart it is composed against is in Explore's store; it does not necessarily
 * draw it. An extension holding the write draws it with `charts.AssetChart`
 * and portals into the room made here.
 *
 * Three states, not two. `previewable` false means this page has no held
 * version it could draw, so nothing should be said about versions at all.
 * `previewable` true with no form data is the live chart, *labelled* as the
 * live chart -- the state that used to be silent, which is how a reader could
 * look at the published chart and act on it with nothing on screen
 * contradicting them. With form data it is the held version.
 */
import type { JsonObject } from '@superset-ui/core';

/** An asset underneath this chart that is holding a version of its own. */
export interface HeldDataset {
  title?: string | null;
  author?: string | null;
}

export interface HeldVersionState {
  /** Whether this page has a held version of its chart it could draw. */
  previewable: boolean;
  /** The held chart, composed against the live one, or null for the live one. */
  formData: JsonObject | null;
  /**
   * A change still open on the dataset this chart is built on, if any. The
   * chart is drawn against the *live* dataset, because that is what applying
   * this write today would query, so a version written against columns that
   * are themselves held will fail or mislead -- and whoever is reading it
   * needs to be told which of the two has to be decided first.
   */
  heldDataset?: HeldDataset | null;
}

export const HELD_VERSION_EVENT = 'superset:explore:held-version';

const NOTHING: HeldVersionState = { previewable: false, formData: null };

export function announceHeldVersion(state: HeldVersionState): void {
  window.dispatchEvent(new CustomEvent(HELD_VERSION_EVENT, { detail: state }));
}

export function onHeldVersion(
  handler: (state: HeldVersionState) => void,
): () => void {
  const listener = (event: Event) =>
    handler((event as CustomEvent<HeldVersionState>).detail ?? NOTHING);
  window.addEventListener(HELD_VERSION_EVENT, listener);
  return () => window.removeEventListener(HELD_VERSION_EVENT, listener);
}

/**
 * The DOM id of the grid column a contributed panel docks in.
 *
 * A panel has to sit beside the asset, not above it, or its height pushes the
 * whole column down the page. Explore lays out an empty slot in its right-hand
 * column and the panel portals into it; the dashboard's extension sidebar
 * column carries the same id, so one lookup finds the right column on either
 * surface and the name is not Explore's.
 */
export const DOCKED_PANEL_SLOT = 'superset-docked-panel-slot';

/**
 * The DOM id of the chart column, while a held version has it.
 *
 * Explore stops drawing its own chart for as long as one is on screen -- two
 * charts in one column would be two answers to "what am I looking at" -- and
 * lays this out in its place for whoever is drawing the held one to portal
 * into. Announced on the channel above rather than discovered from the DOM,
 * so the column is vacated and reclaimed by the same fact that greys the
 * controls.
 */
export const HELD_VERSION_SLOT = 'explore-held-version-slot';
