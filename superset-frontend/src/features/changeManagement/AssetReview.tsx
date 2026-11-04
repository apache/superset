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
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useHistory } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import ReviewBanner from './ReviewBanner';
import WhatChangedPanel from './WhatChangedPanel';
import RequestReviewModal from './RequestReviewModal';
import RequestChangesModal from './RequestChangesModal';
import WithdrawModal from './WithdrawModal';
import ApprovePublishModal from './ApprovePublishModal';
import AssetLockedModal from './AssetLockedModal';
import DiscardChangesModal from './DiscardChangesModal';
import DatasetReviewModal from './DatasetReviewModal';
import UnpublishedNotice from './UnpublishedNotice';
import { useAssetReview } from './useAssetReview';
import { useProposedPreview } from './useProposedPreview';
import { afterRemovalPath } from './display';
import {
  announceEditAfterWithdraw,
  announceReviewChanged,
  onAssetLocked,
  onChangeCaptured,
  onDiscardChanges,
  onRequestReview,
  onShowWhatChanged,
  onWithdrawToEdit,
  REVIEW_PANEL_SLOT,
  type RequestReviewDetail,
} from './events';
import {
  approveChange,
  discardChange,
  refusalMessage,
  submitForReview,
  withdrawRequest,
} from './api';
import type { ReviewAssetType } from './types';
import { requestFacts, reviewLog } from './log';

/**
 * The banner occupies its own full-width row.
 *
 * The side panel used to sit in here beside it, which made this row as
 * tall as the panel and pushed the dashboard's charts down the page. The
 * panel is portalled into the host's right-hand column instead.
 */
const Dock = styled.div`
  display: block;
`;

/**
 * Where the panel goes on a host that lays out no slot for it.
 *
 * Anchored rather than left in the flow, because in the flow a 320px
 * block simply pushes the page's own content down -- which is the bug
 * this whole arrangement exists to avoid.
 */
const FloatingPanel = styled.div`
  ${({ theme }) => `
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: ${theme.zIndexPopupBase ?? 1030};
    display: flex;
  `}
`;

/**
 * How long Request review waits for its own save to produce a draft.
 *
 * The click saves and announces together, so the draft arrives a moment
 * later; a save measured here landed in under 200ms. Generous for a slow
 * one, and nowhere near long enough to still be armed when the author does
 * something else.
 */
const REQUEST_DIALOG_GRACE_MS = 10_000;

export interface AssetReviewProps {
  assetType: ReviewAssetType;
  assetId?: number | null;
  /** Dashboards only: still a draft, so edits are outside the gate. */
  unpublished?: boolean;
  /**
   * Dashboards only: the host is in edit mode.
   *
   * Passed in rather than read from the store, because this component is
   * mounted in Explore too and Explore's store has no `dashboardState` to
   * read.
   */
  editing?: boolean;
  /** Edit mode with unsaved edits on screen; changes what the banner says. */
  editingUnsaved?: boolean;
  /**
   * Called after a decision lands on an asset that still exists, so the host
   * can reload it.
   *
   * Not called when the decision was to approve a delete: both hosts wire
   * this to `window.location.reload()`, and reloading the page of an asset
   * that has just gone is how the reviewer ended up on the removed chart's
   * Explore page reading "Missing dataset". That case navigates instead, so
   * the prop keeps its meaning and its signature.
   */
  onApplied?: () => void;
  /**
   * The asset's live title, whenever it is known.
   *
   * A host that lets the author edit the title in place keeps showing the
   * proposed one after a captured save, while the banner beside it says
   * viewers and author are both on the live version. This is how the host
   * learns what the live version is actually called.
   */
  onLiveTitle?: (title: string) => void;
}

/**
 * Everything the review workflow adds to an asset page: the banner, the
 * side panel, and the two modals.
 *
 * Kept as one mountable component so a host page adds review with a single
 * element and no state of its own. It renders nothing at all when there is
 * no open change or the feature is off, which is the common case.
 */
export default function AssetReview({
  assetType,
  assetId,
  unpublished = false,
  editing = false,
  editingUnsaved = false,
  onApplied,
  onLiveTitle,
}: AssetReviewProps) {
  const { changeRequest, refresh } = useAssetReview(assetType, assetId);
  const [panelOpen, setPanelOpen] = useState(false);
  const [approveNote, setApproveNote] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [lockedOpen, setLockedOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { addSuccessToast, addDangerToast } = useToasts();
  const history = useHistory();
  const preview = useProposedPreview(changeRequest);
  /**
   * The change request as the window listeners below see it.
   *
   * They are registered once, so the request they closed over is the one
   * from the first render -- which is `null` on every page that has not
   * fetched yet. Only used for log lines, where a stale `null` is the
   * difference between an account of what happened and a line saying
   * nothing.
   */
  const changeRequestRef = useRef(changeRequest);
  changeRequestRef.current = changeRequest;
  const [pendingRequest, setPendingRequest] =
    useState<RequestReviewDetail | null>(null);
  /** When Request review was asked for, so the wait below can time out. */
  const armedAtRef = useRef<number | null>(null);
  /** Bumped by the deadline timer to re-run the wait. */
  const [armedTick, setArmedTick] = useState(0);
  /**
   * How many writes have been captured on this page.
   *
   * Counted rather than flagged so the wait below can ask "has one landed
   * *since* I was armed", which is the only form of the question that
   * survives an author who saves twice.
   */
  const capturesRef = useRef(0);
  const [captureTick, setCaptureTick] = useState(0);
  /** The count when Request review was asked for. */
  const capturesWhenArmedRef = useRef(0);

  // The live title travels with every read of the change request, so the
  // host does not have to fetch the asset again to find out that what it is
  // showing is the author's proposal rather than what is published.
  //
  // Not while Show changes is on. That switch hydrates the whole dashboard
  // from the proposal, title included, and this would put the title straight
  // back -- so the one thing the author turned the switch on to see would be
  // the one thing it did not show.
  const liveTitle = changeRequest?.asset_title;
  const previewing = preview.showing;
  useEffect(() => {
    if (liveTitle && onLiveTitle && !previewing) {
      onLiveTitle(liveTitle);
    }
  }, [liveTitle, onLiveTitle, previewing]);

  // Pressing Edit while the preview is on would strand the author: the
  // switch is withheld in edit mode, so they would be editing the proposal
  // with no way back to live, the banner would tell them they were looking
  // at the live version, and their next save would post the proposal as
  // their own edit. Return to live first; the toggle keeps them in edit
  // mode on the way back.
  const previewToggle = preview.toggle;
  const previewBusy = preview.busy;
  useEffect(() => {
    if (editing && previewing && !previewBusy) {
      // Explicitly off. Called bare it relied on `undefined` reading as
      // false, which worked and did not typecheck.
      previewToggle(false);
    }
  }, [editing, previewing, previewBusy, previewToggle]);

  // The edit header asks for review; this component owns the modal. The
  // request is held until the change the save produced has actually loaded,
  // because the modal needs it.
  useEffect(
    () =>
      onRequestReview(detail => {
        capturesWhenArmedRef.current = capturesRef.current;
        reviewLog('request review: asked for', {
          savingFirst: detail.savingFirst,
          capturesSoFar: capturesRef.current,
          ...requestFacts(changeRequestRef.current),
        });
        setPendingRequest(detail);
      }),
    [],
  );

  /**
   * Count the captures, so Request review can wait for the save it began.
   *
   * This used to put the live asset back on screen as well. It was fixing
   * a real contradiction -- the page kept the author's edits while the
   * banner said they were looking at the live version -- but it fixed it
   * the wrong way round. The mocks (author screen 2) carry the SOW line
   * "the author sees their draft when they open the asset, with a link to
   * the current version", so the page was right and the banner was wrong.
   * Forcing live made the sentence true by taking the author's work off
   * the screen.
   *
   * Nothing replaces it here. The author now stays in edit mode through a
   * captured save, so the canvas already holds exactly what was saved and
   * there is nothing to re-render.
   */
  useEffect(
    () =>
      onChangeCaptured(() => {
        capturesRef.current += 1;
        setCaptureTick(tick => tick + 1);
      }),
    [],
  );

  // Another editor pressed Edit while this change is open. The header
  // cannot explain the lock itself -- it has no idea whose change it is.
  useEffect(() => onAssetLocked(() => setLockedOpen(true)), []);

  // The host's own Edit button, pressed on a change that is with a
  // reviewer. Same dialog the banner's Edit raises, because it is the same
  // decision: the author cannot edit this without taking it off somebody
  // else's queue, and only this component knows whose.
  useEffect(
    () =>
      onWithdrawToEdit(() => {
        reviewLog(
          'withdraw: asked for by the host before editing',
          requestFacts(changeRequestRef.current),
        );
        setWithdrawOpen(true);
      }),
    [],
  );
  useEffect(() => onShowWhatChanged(() => setPanelOpen(true)), []);
  useEffect(() => onDiscardChanges(() => setDiscardOpen(true)), []);

  // Someone who can decide this change is shown what they are deciding on,
  // without having to go looking for it.
  const isReviewer =
    changeRequest?.status === 'pending' && !!changeRequest?.can_approve;
  useEffect(() => {
    if (isReviewer) setPanelOpen(true);
  }, [isReviewer]);

  useEffect(() => {
    if (!pendingRequest) {
      armedAtRef.current = null;
      return undefined;
    }
    if (armedAtRef.current === null) armedAtRef.current = Date.now();

    // A click that started a save waits for that save, whatever the status
    // says in the meantime.
    //
    // Waiting on "is there a draft" alone was not enough: an author editing
    // on top of a draft already has one, so the condition was true at the
    // moment of the click and the dialog opened on the *previous* payload
    // while the save replacing it was still in flight -- measured at 70ms
    // ahead of it. Submitting in that window sends the reviewer a draft
    // the author had already moved past, and the save that lands after it
    // reopens the request they thought they had submitted.
    const savedSinceArmed =
      capturesRef.current > capturesWhenArmedRef.current;
    const stillSaving = pendingRequest.savingFirst && !savedSinceArmed;

    if (!stillSaving && changeRequest?.status === 'draft') {
      reviewLog(
        'request review: opening the dialog',
        requestFacts(changeRequest),
      );
      setRequestOpen(true);
      setPendingRequest(null);
      armedAtRef.current = null;
      return undefined;
    }

    // Not a draft yet, and that is usually because the click's own save is
    // still in flight.
    //
    // The toolbar's Request review saves first and announces in the same
    // breath, so this ran against the status from *before* that write --
    // measured at 6ms after the click, against a save that landed at
    // 190ms. Deciding there meant deciding on a status the save was in the
    // middle of replacing: an author whose last change had been approved
    // got the save and no dialog at all.
    //
    // So wait for the draft the save is about to produce. Bounded, because
    // the first version of this waited forever and opened the dialog
    // minutes later after an unrelated save, with nothing on screen
    // connecting it to the click that armed it. Long enough for a slow
    // round trip, far too short to reach another edit.
    const waited = Date.now() - armedAtRef.current;
    if (waited >= REQUEST_DIALOG_GRACE_MS) {
      reviewLog('request review: gave up waiting for a draft to submit', {
        waitedMs: waited,
        savingFirst: pendingRequest.savingFirst,
        savedSinceArmed,
        ...requestFacts(changeRequest),
      });
      setPendingRequest(null);
      armedAtRef.current = null;
      return undefined;
    }

    // Nothing may arrive at all -- a save that fails, or a click with
    // nothing to save -- so wake up once at the deadline to let go.
    const timer = window.setTimeout(
      () => setArmedTick(tick => tick + 1),
      REQUEST_DIALOG_GRACE_MS - waited + 20,
    );
    return () => window.clearTimeout(timer);
    // `captureTick` is what moves when a save lands: `capturesRef` is read
    // above but a ref never re-runs an effect on its own.
  }, [
    pendingRequest,
    changeRequest,
    changeRequest?.status,
    armedTick,
    captureTick,
  ]);

  /**
   * Runs one workflow action and reports whether it landed.
   *
   * The boolean matters to exactly one caller: approving a delete has to
   * navigate away afterwards, and a refusal here is caught and toasted rather
   * than thrown, so without it the caller cannot tell a published delete from
   * one the server turned down and would walk the reviewer off a page that is
   * still perfectly alive.
   */
  const run = useCallback(
    async (
      action: () => Promise<unknown>,
      message: string,
      applied = false,
    ): Promise<boolean> => {
      setBusy(true);
      reviewLog('transition: starting', {
        intent: message,
        ...requestFacts(changeRequest),
      });
      try {
        await action();
        reviewLog('transition: server accepted it', {
          intent: message,
          ...requestFacts(changeRequest),
        });
        addSuccessToast(message);
        await refresh();
        // Tell everyone else reading this request's status, not just our
        // own hook. The edit toolbar reads it separately, and refreshing
        // only here is what let the two disagree about whether a change
        // was still a draft.
        announceReviewChanged();
        if (applied) onApplied?.();
        return true;
      } catch (error) {
        // Surface the server's own sentence. Every refusal the workflow can
        // raise already carries one written for the person reading it, so
        // replacing them with a generic failure here would throw away the
        // only useful part.
        const refusal = await refusalMessage(error);
        reviewLog('transition: server refused it', {
          intent: message,
          refusal: refusal ?? String(error),
          ...requestFacts(changeRequest),
        });
        addDangerToast(refusal ?? t('Something went wrong.'));
        // Then re-read. The commonest refusal here is that the change moved
        // while this page had it open, and being told so is only actionable
        // once the page is showing the version that refused (R4-04).
        await refresh();
        // A refusal usually means the status is not what this page thought,
        // so the other readers are wrong too and need the same correction.
        announceReviewChanged();
        return false;
      } finally {
        setBusy(false);
      }
    },
    [addDangerToast, addSuccessToast, onApplied, refresh],
  );

  // Into the host's slot when it offers one; inline otherwise, so a page
  // without the slot (Explore) still shows the panel rather than nothing.
  const renderPanel = (panel: JSX.Element) => {
    const slot =
      typeof document === 'undefined'
        ? null
        : document.getElementById(REVIEW_PANEL_SLOT);
    return slot ? (
      createPortal(panel, slot)
    ) : (
      <FloatingPanel>{panel}</FloatingPanel>
    );
  };

  if (!changeRequest) {
    return unpublished ? (
      <UnpublishedNotice
        busy={busy}
        onRequestPublish={async () => {
          await run(async () => {
            const { requestPublish } = await import('./api');
            return requestPublish(assetId as number);
          }, t('Publishing saved. Choose who reviews it.'));
          // The capture only creates the draft; the button says "Request
          // to publish", so it has to go on and request. Same hand-off the
          // edit header uses: wait for the change the save produced, then
          // open the modal on it.
          //
          // Nothing to wait for, though: the capture is already done by
          // the time this line runs, because the call above is awaited.
          // Arming this as a save in flight would wait for a capture that
          // has already been and gone, and time out with no dialog at all.
          // What is still outstanding is only the re-read, which is what
          // the wait on "status is draft" covers.
          setPendingRequest({ savingFirst: false });
        }}
      />
    ) : null;
  }

  return (
    <Dock>
      <div style={{ flex: 1 }}>
        <ReviewBanner
          changeRequest={changeRequest}
          editing={editing}
          editingUnsaved={editingUnsaved}
          busy={busy}
          // Withheld entirely in edit mode, not merely hidden: the banner
          // chooses its wording from whether this prop is here, and hiding
          // only the switch would leave it saying "turn on Show changes"
          // next to no switch (QA-19).
          //
          // The switch cannot work in edit mode. It re-hydrates the whole
          // dashboard, and hydration resets `hasUnsavedChanges` and replaces
          // the layout with the cached live copy -- so toggling it while
          // editing threw the author's unsaved edits away and handed back an
          // edit session that looked untouched.
          showChanges={
            preview.canPreview && !editing
              ? {
                  showing: preview.showing,
                  busy: preview.busy,
                  toggle: preview.toggle,
                }
              : undefined
          }
          onShowWhatChanged={() => {
            reviewLog(
              'banner: Show what changed opened',
              requestFacts(changeRequest),
            );
            setPanelOpen(true);
          }}
          onRequestReview={() => {
            // Straight to the dialog, with nothing to wait for: the draft
            // this is about is the one the banner is drawn from. The
            // toolbar's button is the one that saves first.
            reviewLog(
              'banner: Request review pressed',
              requestFacts(changeRequest),
            );
            setRequestOpen(true);
          }}
          onRequestChanges={() => {
            reviewLog(
              'banner: Request changes pressed',
              requestFacts(changeRequest),
            );
            setChangesOpen(true);
          }}
          onApprove={() => {
            reviewLog('banner: Approve pressed', requestFacts(changeRequest));
            setApproveOpen(true);
          }}
          onWithdraw={() => {
            reviewLog('banner: Withdraw pressed', requestFacts(changeRequest));
            setWithdrawOpen(true);
          }}
          onDiscard={() => {
            reviewLog('banner: Discard pressed', requestFacts(changeRequest));
            setDiscardOpen(true);
          }}
        />
      </div>

      {panelOpen && changeRequest.dataset_detail ? (
        <DatasetReviewModal
          changeRequest={changeRequest}
          open
          onClose={() => setPanelOpen(false)}
          review={
            isReviewer
              ? {
                  busy,
                  onApprove: () => setApproveOpen(true),
                  onRequestChanges: () => setChangesOpen(true),
                }
              : undefined
          }
        />
      ) : null}

      {panelOpen && !changeRequest.dataset_detail
        ? renderPanel(
            <WhatChangedPanel
              changeRequest={changeRequest}
              onClose={() => setPanelOpen(false)}
              review={
                isReviewer
                  ? {
                      busy,
                      onApprove: note => {
                        setApproveNote(note);
                        setApproveOpen(true);
                      },
                      onRequestChanges: () => setChangesOpen(true),
                    }
                  : undefined
              }
            />,
          )
        : null}

      <RequestReviewModal
        changeRequest={changeRequest}
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        onEditorsChanged={refresh}
        onSubmit={async (note, approverId) => {
          setRequestOpen(false);
          await run(
            () => submitForReview(changeRequest.id, note, approverId),
            t('Review requested.'),
          );
        }}
      />

      <RequestChangesModal
        changeRequest={changeRequest}
        open={changesOpen}
        onClose={() => setChangesOpen(false)}
        onSubmit={async note => {
          setChangesOpen(false);
          await run(async () => {
            const { requestChanges } = await import('./api');
            return requestChanges(changeRequest.id, note);
          }, t('Changes requested.'));
        }}
      />

      <ApprovePublishModal
        changeRequest={changeRequest}
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        onConfirm={async () => {
          setApproveOpen(false);
          // An approved delete has no asset left to publish or to reload, so
          // it gets neither the publish wording nor `onApplied`: the host
          // wires that to a reload of the page this change has just emptied.
          const removing = changeRequest.operation === 'delete';
          const landed = await run(
            () =>
              approveChange(
                changeRequest.id,
                approveNote || undefined,
                changeRequest.revision ?? changeRequest.changed_on,
              ),
            removing
              ? t(
                  'Approved. The %s is archived, and can be restored from Recently archived.',
                  changeRequest.asset_type,
                )
              : t('Changes approved and published.'),
            !removing,
          );
          // Only once the server has actually taken the delete. A refusal
          // (a stale baseline, an author who lost edit access) leaves the
          // asset where it was, and walking away from it would hide the
          // refusal the toast just explained.
          if (landed && removing) {
            history.push(afterRemovalPath());
          }
        }}
      />

      <WithdrawModal
        changeRequest={changeRequest}
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        onConfirm={async () => {
          setWithdrawOpen(false);
          const withdrawn = await run(
            () => withdrawRequest(changeRequest.id),
            t('Request withdrawn. Your changes are editable again.'),
          );
          // The button says "Withdraw and edit". It used to do only the
          // first half, leaving the author on the same read-only page
          // having to press Edit again for what they had just confirmed.
          //
          // Only on success: a refused withdrawal means the change is not
          // theirs to edit, and opening the editor anyway would invite a
          // save the server is about to turn down.
          if (withdrawn) announceEditAfterWithdraw();
        }}
      />

      <DiscardChangesModal
        changeRequest={changeRequest}
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onConfirm={async () => {
          setDiscardOpen(false);
          setLockedOpen(false);
          await run(
            () => discardChange(changeRequest.id),
            t('Changes discarded.'),
            true,
          );
        }}
      />

      <AssetLockedModal
        changeRequest={changeRequest}
        open={lockedOpen}
        onClose={() => setLockedOpen(false)}
        onView={() => {
          setLockedOpen(false);
          setPanelOpen(true);
        }}
        onDiscard={() => setDiscardOpen(true)}
      />
    </Dock>
  );
}
