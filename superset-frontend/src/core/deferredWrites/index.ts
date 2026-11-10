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
 * @fileoverview Host side of the deferred-write contract.
 *
 * `isDeferredWrite` answers after the fact: a response came back `202`, so
 * the write did not reach the asset. That covers every save path, and it is
 * not enough on its own, because some of the host's wording is chosen
 * *before* the request goes out. A delete dialog has to promise either "this
 * dashboard will be moved to Recently Archived" or "this needs review before
 * it is removed", and it has to pick one while the dashboard is still there.
 *
 * The host cannot work that out. Whether a write will be held is the
 * deferring party's rule and may depend on the asset's history rather than
 * its current state -- a dashboard that has never been published is not
 * reviewed, which is a fact about its past. So the host asks, through an
 * oracle an extension registers, and takes "no" for an answer when nothing
 * is registered.
 *
 * Asking is what removes the extension's name from the host. Every one of
 * these sites used to read a specific feature flag, which is the same
 * coupling as importing the extension's module with extra steps: core knew
 * both that the feature existed and what it was called.
 */

import { useEffect, useMemo, useState } from 'react';
import { deferredWriteMessage, isDeferredWrite } from '@superset-ui/core';
import type { deferredWrites as api } from '@apache-superset/core';
import { logging } from '@apache-superset/core/utils';
import { Disposable } from '../models';
import { createEventEmitter } from '../utils';

type DeferredWrite = api.DeferredWrite;
type DeferralOracle = api.DeferralOracle;

/**
 * One oracle at a time.
 *
 * Two extensions deferring writes to the same asset is not a case the host
 * can resolve: their answers would have to be combined, and "either would
 * hold it" and "both would hold it" are different promises to make in a
 * dialog. A second registration is refused rather than silently winning, so
 * the deployment finds out at startup instead of through wrong copy.
 */
let oracle: DeferralOracle | undefined;

const deferredEmitter = createEventEmitter<DeferredWrite>();

export function registerDeferralOracle(next: DeferralOracle): Disposable {
  if (oracle && oracle !== next) {
    logging.warn(
      'A deferral oracle is already registered; ignoring the second one. ' +
        'Only one extension may decide whether a write is held.',
    );
    return new Disposable(() => {});
  }
  oracle = next;
  return new Disposable(() => {
    if (oracle === next) {
      oracle = undefined;
    }
  });
}

/**
 * Would a write to each of these assets be held?
 *
 * Keyed by id as a string, because a caller holding numeric ids and a caller
 * holding slugs both index the result the same way.
 *
 * With no oracle registered every answer is `false`, which is the reading
 * that matches an install with no such extension: writes apply. A failing
 * oracle gets the same answer rather than an exception -- a list page that
 * cannot reach the extension still has to render, and the wording it falls
 * back to describes what the host itself does.
 */
export async function wouldDefer(
  assetType: string,
  assetIds: (number | string)[],
): Promise<Record<string, boolean>> {
  const none = Object.fromEntries(assetIds.map(id => [String(id), false]));
  if (!oracle || assetIds.length === 0) {
    return none;
  }
  try {
    const answered = await oracle.wouldDefer(assetType, assetIds);
    // Merged over `none` so an id the oracle did not answer for reads as
    // "not deferred" rather than `undefined`, which a caller would have to
    // special-case at every use.
    return { ...none, ...answered };
  } catch (error) {
    logging.warn('A deferral oracle failed; treating writes as applied', error);
    return none;
  }
}

/**
 * What should be hydrated for this asset instead of the live one?
 *
 * `wouldDefer` answers a question a button asks. This answers the one a page
 * asks as it opens: the person may be holding a version of their own, and
 * hydrating the published asset over it shows them a state of their own work
 * they did not leave it in -- and then saves on top of it.
 *
 * `null` means hydrate the live asset, and it is the answer for every way of
 * not getting one: nothing registered, an oracle that does not answer this
 * question, an oracle that throws, an oracle that answers `undefined`. That
 * is deliberate. The host's own behaviour -- open what the server sent -- is
 * correct in all four cases, so there is nothing for a caller to handle and
 * no second code path for it to get wrong.
 *
 * The payload is `unknown`: its shape belongs to the asset type, and the
 * caller casts to the shape it already hydrates.
 */
/**
 * Ask whether the host may go ahead with something a person just asked for.
 *
 * Awaited before the host acts, so whoever holds the rule can put its own
 * question to the person first. `true` when nothing is registered, when the
 * oracle does not implement it, or when it throws: the server refuses a
 * write it will not accept, and a holder that is broken must not be able to
 * lock an editor shut.
 */
export async function mayProceed(
  intent: 'edit' | 'write',
  assetType: string,
  assetId: number | string,
): Promise<boolean> {
  if (!oracle?.mayProceed) {
    return true;
  }
  try {
    // Only an explicit `false` stops the host, so an oracle that answers
    // nothing at all is read the same as one that is not there.
    return (await oracle.mayProceed(intent, assetType, assetId)) !== false;
  } catch (error) {
    logging.warn('A deferral oracle failed; letting the action proceed', error);
    return true;
  }
}

export async function heldVersion(
  assetType: string,
  assetId: number | string,
): Promise<unknown | null> {
  if (!oracle?.heldVersion) {
    return null;
  }
  try {
    // `?? null` so an oracle that answers `undefined` reads as "nothing
    // held", the same normalisation `wouldDefer` does by merging over
    // all-false: one absent answer, one meaning.
    return (await oracle.heldVersion(assetType, assetId)) ?? null;
  } catch (error) {
    logging.warn('A deferral oracle failed; treating nothing as held', error);
    return null;
  }
}

/** Whether anything is deciding deferral at all. */
export function hasDeferralOracle(): boolean {
  return oracle !== undefined;
}

/**
 * Tell any listening surface that a write was deferred.
 *
 * Called by the host's save paths once their own state is settled. A listener
 * reads the store to decide what to do, so announcing mid-sequence publishes
 * a half-applied state.
 */
export function announceDeferred(write: DeferredWrite): void {
  deferredEmitter.fire(write);
}

export const onDeferred = deferredEmitter.subscribe;

/**
 * Previous answers may now be wrong.
 *
 * A deferral is only one of the events that changes what `wouldDefer` would
 * say. Approving a change makes every later write to that asset governed,
 * discarding one may make it exempt again, and a deployment may turn its rule
 * off -- none of which the host can see. So the party holding the rule says
 * so, and every surface that asked earlier asks again.
 */
const invalidationEmitter = createEventEmitter<void>();

export function invalidateDeferrals(): void {
  invalidationEmitter.fire(undefined);
}

export const onDeferralsInvalidated = invalidationEmitter.subscribe;

/**
 * Ask the oracle for a set of rows.
 *
 * One request for the whole page, not one per row: a list page needs an
 * answer for every row it draws, and asking per row turns a page render into
 * a burst of requests.
 *
 * Re-asks when the ids change and when a write is deferred anywhere, since
 * the row that was just deferred is the one whose answer is now stale.
 */
/**
 * Ask the oracle for a set of rows.
 *
 * One request for the whole page, not one per row: a list page needs an
 * answer for every row it draws, and asking per row turns a page render into
 * a burst of requests.
 *
 * Re-asks when the ids change, when a write is deferred anywhere, and when
 * the party holding the rule says previous answers have moved on.
 *
 * With nothing registered this touches no state at all, and answers all-false
 * from the first render. That matters more than it sounds: an earlier version
 * started at `{}` and then set all-false once the ids arrived, which
 * re-rendered the surface around it for no change in answer, and a
 * confirmation dialog with a controlled "type DELETE to confirm" input lost
 * what had been typed into it.
 */
export function useDeferral(
  assetType: string,
  assetIds: (number | string)[],
): Record<string, boolean> {
  const key = assetIds.map(String).sort().join(',');
  const [answered, setAnswered] = useState<Record<string, boolean> | null>(
    null,
  );

  useEffect(() => {
    if (!hasDeferralOracle()) {
      return undefined;
    }
    let current = true;
    const ask = () => {
      wouldDefer(assetType, key ? key.split(',') : []).then(next => {
        if (current) setAnswered(next);
      });
    };
    ask();
    const subscriptions = [onDeferred(ask), onDeferralsInvalidated(ask)];
    return () => {
      current = false;
      subscriptions.forEach(subscription => subscription.dispose());
    };
  }, [assetType, key]);

  // Memoised on the contents, so a caller that spreads this into props does
  // not hand them a new object on every render.
  const nothingHeld = useMemo(
    () =>
      Object.fromEntries(
        (key ? key.split(',') : []).map(id => [id, false] as const),
      ),
    [key],
  );

  return answered ?? nothingHeld;
}

/**
 * Read a response: a `DeferredWrite` when the write was accepted and not
 * applied, `null` when it really was applied.
 *
 * The message is whatever the deferring party wrote, because only they know
 * what happens next. The fallback is the host's, and deliberately says only
 * what the host can be sure of.
 */
const read: api.DeferredWriteReader = response => {
  if (!isDeferredWrite(response)) {
    return null;
  }
  const body = (response as { json?: unknown })?.json ?? response;
  const held = body as { id?: number | string; count?: number } | undefined;
  return {
    message: deferredWriteMessage(
      body as Parameters<typeof deferredWriteMessage>[0],
      'Your changes were accepted but are not live yet.',
    ),
    ...(held?.id === undefined ? {} : { reference: { id: held.id } }),
    ...(held?.count === undefined ? {} : { count: held.count }),
  };
};

/** The namespace extensions see as `deferredWrites` on `@apache-superset/core`. */
export const deferredWrites: api.DeferredWritesApi = {
  read,
  announce: announceDeferred,
  onDeferred: listener => {
    const subscription = onDeferred(listener);
    return () => subscription.dispose();
  },
  registerOracle: oracle => {
    registerDeferralOracle(oracle);
  },
  wouldDefer,
  heldVersion,
  mayProceed,
  invalidate: invalidateDeferrals,
};
