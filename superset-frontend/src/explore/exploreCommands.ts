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
 * @fileoverview The two things Explore can do for whoever is holding a write.
 *
 * `deferredWrites` lets an extension stand between a save and the asset and
 * answer "accepted, not applied". Explore already reads one half of that
 * contract: `pages/Chart` asks `heldVersion` as it opens and hydrates from
 * whatever is held, so an author lands on their own version rather than on
 * the published one.
 *
 * The other half is what a *surface* has to do about it, and both pieces of
 * it are the host's own work:
 *
 * 1. **Draw a held version.** A chart is drawn from the store, through
 *    `chartAction` and `SuperChart`, and an extension has none of the three:
 *    `@superset-ui/core` is deliberately not shared (see
 *    `webpack.config.js`) and neither is `react-redux`, so an extension that
 *    imported them would be talking to a second store nothing populates.
 * 2. **Reload once a held write has been applied.** Explore caches its form
 *    data under a `form_data_key` in the URL, and after a held save that key
 *    holds the pre-application form data. A plain reload reads the key back
 *    and shows the old chart.
 *
 * So the host keeps both and publishes them as commands, named for what this
 * page does rather than for anybody's reason for wanting it. Holding a write for a decision is one
 * reason a write is held and this is about the outcome, the same distinction
 * `deferredWrites` draws in its own file comment. Whether a command exists
 * at all is the answer to "can this page do that": on a page with no chart
 * in it neither is registered, and a caller asks `getCommand` rather than
 * being told a feature flag.
 */
import { useEffect, useRef } from 'react';
import { JsonObject, QueryFormData } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { commands } from 'src/core/commands';
import { composeHeldChart } from 'src/explore/heldChart';
import {
  announceHeldVersion,
  type HeldDataset,
} from 'src/explore/heldVersionChannel';

/**
 * Put a held version of this chart on screen, or the live chart back.
 *
 * Arguments:
 *
 * 1. `heldFields` -- the write that is being held, as the fields it would
 *    apply. `null`, `undefined` or an empty body means "the live chart".
 * 2. `heldDataset` -- a dataset this chart is built on that is itself
 *    holding a version, if there is one, so the preview can say which of
 *    the two has to be decided first. It is drawn against the live dataset,
 *    because that is what applying this write today would query.
 *
 * Returns whether the version asked for is now on screen: `false` means the
 * held fields do not compose into a chart that can be drawn, and the live
 * chart was left where it was.
 */
export const SHOW_HELD_VERSION_COMMAND = 'explore.heldVersion.show';

/**
 * Reload Explore so it shows the chart as the server now has it.
 *
 * For the caller that has just had a held write applied: the asset has
 * changed under the page, and the page's own cached form data describes it
 * as it was before. Takes nothing and returns nothing.
 */
export const RELOAD_COMMAND = 'explore.reload';

/**
 * Offer both commands for as long as Explore is on screen.
 *
 * Registered from the page rather than once at startup, and disposed on the
 * way out, because both are about *this* chart: the live form data the first
 * composes against is the page's, and a command left registered by a page
 * that has gone would draw a held version over whatever came next.
 *
 * The form data is read through a ref so the registration survives every
 * control the author touches. Re-registering on each change would be a
 * warning per keystroke -- `registerCommand` overwrites and says so -- and
 * would hand the caller a command identity that moves under it.
 */
export function useExploreCommands(
  liveFormData: QueryFormData | undefined,
  reload: () => void,
): void {
  const liveFormDataRef = useRef(liveFormData);
  useEffect(() => {
    liveFormDataRef.current = liveFormData;
  }, [liveFormData]);
  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  useEffect(() => {
    const registrations = [
      commands.registerCommand(
        {
          id: SHOW_HELD_VERSION_COMMAND,
          title: t('Show a held version of this chart'),
          description: t(
            'Draw the version of this chart that a write holder is keeping, in place of the live one. Called with nothing, it puts the live chart back.',
          ),
        },
        (heldFields?: JsonObject | null, heldDataset?: HeldDataset | null) => {
          const held =
            heldFields && Object.keys(heldFields).length ? heldFields : null;
          // The composition is the host's own (`heldChart.ts`): the held
          // fields laid over the chart as it is now, which is what applying
          // them would produce, rather than a snapshot the holder assembled
          // separately. A body with no parseable `params` -- a REST `PUT`
          // that moves only `viz_type`, say -- has nothing to be a snapshot
          // of, and the live chart underneath is what makes it drawable at
          // all.
          const drawable = held
            ? composeHeldChart(liveFormDataRef.current, held)
            : null;
          // `previewable` says this page has a version it could draw, which
          // is true in all three answers below -- including the two that put
          // the live chart on screen. The live chart being *labelled* as the
          // live chart is the whole point of the distinction: unlabelled, it
          // is a default somebody can act on without ever having looked.
          announceHeldVersion({
            previewable: true,
            formData: drawable,
            heldDataset: heldDataset ?? null,
          });
          return !held || !!drawable;
        },
      ),
      commands.registerCommand(
        {
          id: RELOAD_COMMAND,
          title: t('Reload this chart from the server'),
          description: t(
            'Reload Explore so it shows the chart as the server now has it, rather than the form data this page had cached.',
          ),
        },
        () => reloadRef.current(),
      ),
    ];
    return () => {
      registrations.forEach(registration => registration.dispose());
      // Whatever the page was left showing, it is not this page's to keep
      // once it is gone.
      announceHeldVersion({ previewable: false, formData: null });
    };
  }, []);
}
