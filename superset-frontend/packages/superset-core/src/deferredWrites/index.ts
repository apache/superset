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
 * Writes that were accepted and not applied.
 *
 * An extension may stand between a save and the asset it would change --
 * a four-eyes review, a scheduled publish, an external approval system --
 * and answer `202` with the write recorded rather than performed. The host
 * has to be able to say so without knowing which extension did it, or
 * whether one is installed at all.
 *
 * This is the frontend counterpart of `superset.change_management` on the
 * Python side, which already does exactly this for HTTP and MCP callers:
 * `is_review_signal`, `review_signal_details` and `refuse_unreviewed_tool_call`
 * let core report a deferred write without naming the extension that
 * deferred it. Nothing equivalent existed here, so every save site in the
 * host grew code that imported a specific extension's helpers -- which is
 * how a feature ends up living in the application it was meant to extend.
 *
 * Deliberately not called "review". Review is one reason a write is held;
 * the contract is about the outcome, not the motive.
 */

/** Why a write did not reach the asset, as the deferring party describes it. */
export interface DeferredWrite {
  /**
   * The sentence written for the person who pressed the button. Supplied by
   * whoever deferred the write, because only they know what happens next --
   * "waiting on a reviewer", "scheduled for Monday", "sent for sign-off".
   * The host shows it rather than composing its own.
   */
  message: string;
  /**
   * What is now holding the write, where there is something to point at: a
   * change request, a schedule entry, a ticket. The host uses it only to
   * offer a link, and treats its absence as normal.
   */
  reference?: { id: number | string; href?: string };
  /** How many writes this one response deferred. A bulk delete defers many. */
  count?: number;
}

/**
 * Whether a response is a write that was accepted and not applied.
 *
 * The host's shared client resolves such a response as a success, because it
 * is one: nothing failed. What must not happen is the host then reporting it
 * as applied -- that is the defect this contract exists to make impossible,
 * and it is the one every save site had to re-implement.
 */
export type DeferredWriteReader = (response: unknown) => DeferredWrite | null;

/**
 * A question asked *before* writing: would a write to this asset be held?
 *
 * A delete dialog cannot word itself without this. "This dashboard will be
 * moved to Recently Archived" and "this needs review before it is removed"
 * are different promises, and a dialog that picks the wrong one is telling
 * the person something that will not happen. The host cannot work the answer
 * out -- whether a write is deferred is the extension's rule, and may depend
 * on the asset's history rather than its current state.
 *
 * Answers are per asset and may be asked in bulk, because a list page needs
 * one answer per row and must not make one request per row.
 */
export interface DeferralOracle {
  wouldDefer(
    assetType: string,
    assetIds: (number | string)[],
  ): Promise<Record<string, boolean>>;
  /**
   * The payload the host should hydrate instead of the live asset, or `null`
   * when nothing is being held.
   *
   * `wouldDefer` is enough to word a button and not enough for the case the
   * host has when it opens an asset. The author may already hold a version of
   * their own -- a write that was accepted and not applied -- and hydrating
   * the published asset over it shows them a state of their own work they did
   * not leave it in, then saves on top of it. So the host asks before it
   * hydrates, and whoever is holding the write says what to hydrate.
   *
   * `unknown` because the shape belongs to the asset type rather than to this
   * contract: a chart's is form data, a dashboard's is a layout, and core
   * describing either is core carrying the extension's model again. The
   * caller casts to the shape it already handles.
   *
   * One asset, not many, and a payload rather than a flag: this is asked when
   * opening one thing, so the bulk shape `wouldDefer` has would mean
   * fetching every row's held version to draw a list.
   *
   * Optional, so every oracle written against `wouldDefer` alone stays valid.
   * An oracle that does not implement it is read as holding nothing.
   */
  /**
   * Whether the host may go ahead with something a person has just asked
   * for, before it happens.
   *
   * Some rules are not about the write but about starting the work: an asset
   * one person is already editing, or an edit that would quietly take a
   * submitted change off somebody's queue. The host cannot know those rules,
   * and discovering them when the save is refused is too late -- the work is
   * already done, and the person is told afterwards.
   *
   * Asked before the host acts, and awaited, so the holder can put its own
   * question to the person and answer once they have decided. Resolving
   * `false` abandons the action silently: whatever the person needs to know,
   * the holder has just shown them, and a second message from the host would
   * be the host explaining a rule it does not have.
   *
   * `intent` is what the host is about to do, in the host's own terms --
   * `edit` for entering an editor, `write` for saving. Not the name of a
   * button, so a rule does not have to be restated for every control that
   * reaches the same action.
   *
   * Optional, and read as permission when absent or when the oracle throws:
   * the server refuses a write it will not accept, so a holder that is
   * broken or slow must not be able to lock an editor shut.
   */
  mayProceed?(
    intent: 'edit' | 'write',
    assetType: string,
    assetId: number | string,
  ): Promise<boolean>;

  heldVersion?(
    assetType: string,
    assetId: number | string,
  ): Promise<unknown | null>;
}

/**
 * Told when a write was deferred, so a surface can refresh itself.
 *
 * A list that has just deferred one of its own rows is already stale, and
 * had no way to know. Subscribing is how a row picks up its new state
 * without the list knowing who deferred it.
 *
 * Returns its own unsubscribe, as the host's other event helpers do.
 */
export type DeferralListener = (deferred: DeferredWrite) => void;

export interface DeferredWritesApi {
  /** Read a response. Returns null for a write that really was applied. */
  read: DeferredWriteReader;
  /** Announce one, for whoever deferred it. */
  announce(deferred: DeferredWrite): void;
  /** Hear about them. */
  onDeferred(listener: DeferralListener): () => void;
  /**
   * Register the installed oracle. One at a time: two extensions both
   * claiming to defer the same write is a configuration error, not a case
   * to merge, and the second registration is refused so the conflict
   * surfaces at startup rather than in a dialog.
   */
  registerOracle(oracle: DeferralOracle): void;
  /**
   * Ask whether writes to these assets would be held. Answers `{}` when no
   * oracle is registered, which every caller must read as "not deferred" --
   * the same shape the host has when no extension is installed.
   */
  wouldDefer(
    assetType: string,
    assetIds: (number | string)[],
  ): Promise<Record<string, boolean>>;
  /**
   * Ask for the version of one asset the host should hydrate instead of the
   * live one. Answers `null` when nothing is held, when no oracle is
   * registered, and when the registered oracle does not answer this question
   * -- the same reading the host has with no extension installed.
   */
  heldVersion(
    assetType: string,
    assetId: number | string,
  ): Promise<unknown | null>;
  /** Ask whether the host may go ahead with an action. */
  mayProceed(
    intent: 'edit' | 'write',
    assetType: string,
    assetId: number | string,
  ): Promise<boolean>;
  /**
   * Say that previous answers may now be wrong.
   *
   * `onDeferred` is not enough on its own. A deferral is one event that
   * changes the answer, and the others are invisible to the host: approving a
   * change makes every later write to that asset governed, discarding one may
   * make it exempt again, and a deployment may simply turn its rule off. Only
   * the party holding the rule knows, so it says so, and surfaces that asked
   * earlier ask again.
   *
   * Without this a list read the answer once and went on offering the wrong
   * wording for a row whose state had moved on -- which looks exactly like a
   * dialog lying about what the button does.
   */
  invalidate(): void;
}

/**
 * The callable surface, declared the way every other namespace here declares
 * it: signatures only. The host installs the implementations on
 * `window.superset` and the extension loader hands this module's bindings to
 * each extension, so these exist at runtime and are types at build time.
 *
 * Without them an extension could not call any of this. `DeferredWritesApi`
 * above describes the shape the host must provide; these are what an
 * extension imports.
 */
export declare function read(response: unknown): DeferredWrite | null;

/** Announce a write that was accepted and not applied. */
export declare function announce(deferred: DeferredWrite): void;

/** Hear about them. Returns its own unsubscribe. */
export declare function onDeferred(listener: DeferralListener): () => void;

/** Offer to answer whether a write to an asset would be held. */
export declare function registerOracle(oracle: DeferralOracle): void;

/** Ask. All-false when nothing is registered. */
export declare function wouldDefer(
  assetType: string,
  assetIds: (number | string)[],
): Promise<Record<string, boolean>>;

/** Ask whether the host may go ahead. `true` when nothing objects. */
export declare function mayProceed(
  intent: 'edit' | 'write',
  assetType: string,
  assetId: number | string,
): Promise<boolean>;

/** Ask what to hydrate instead of the live asset. `null` when nothing is held. */
export declare function heldVersion(
  assetType: string,
  assetId: number | string,
): Promise<unknown | null>;

/** Say that previous answers may now be wrong. */
export declare function invalidate(): void;
