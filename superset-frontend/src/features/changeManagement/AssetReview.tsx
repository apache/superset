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
import { useCallback, useEffect, useState } from 'react';
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
  onAssetLocked,
  onDiscardChanges,
  onRequestReview,
  onShowWhatChanged,
  REVIEW_PANEL_SLOT,
} from './events';
import {
  approveChange,
  discardChange,
  refusalMessage,
  submitForReview,
  withdrawRequest,
} from './api';
import type { ReviewAssetType } from './types';

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

export interface AssetReviewProps {
  assetType: ReviewAssetType;
  assetId?: number | null;
  /** Dashboards only: still a draft, so edits are outside the gate. */
  unpublished?: boolean;
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
  const [pendingRequest, setPendingRequest] = useState(false);

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

  // The edit header asks for review; this component owns the modal. The
  // request is held until the change the save produced has actually loaded,
  // because the modal needs it.
  useEffect(() => onRequestReview(() => setPendingRequest(true)), []);

  // Another editor pressed Edit while this change is open. The header
  // cannot explain the lock itself -- it has no idea whose change it is.
  useEffect(() => onAssetLocked(() => setLockedOpen(true)), []);
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
    if (pendingRequest && changeRequest?.status === 'draft') {
      setRequestOpen(true);
      setPendingRequest(false);
    }
  }, [pendingRequest, changeRequest?.status]);

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
      try {
        await action();
        addSuccessToast(message);
        await refresh();
        if (applied) onApplied?.();
        return true;
      } catch (error) {
        // Surface the server's own sentence. Every refusal the workflow can
        // raise already carries one written for the person reading it, so
        // replacing them with a generic failure here would throw away the
        // only useful part.
        addDangerToast(
          (await refusalMessage(error)) ?? t('Something went wrong.'),
        );
        // Then re-read. The commonest refusal here is that the change moved
        // while this page had it open, and being told so is only actionable
        // once the page is showing the version that refused (R4-04).
        await refresh();
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
          setPendingRequest(true);
        }}
      />
    ) : null;
  }

  return (
    <Dock>
      <div style={{ flex: 1 }}>
        <ReviewBanner
          changeRequest={changeRequest}
          busy={busy}
          showChanges={
            preview.canPreview
              ? {
                  showing: preview.showing,
                  busy: preview.busy,
                  toggle: preview.toggle,
                }
              : undefined
          }
          onShowWhatChanged={() => setPanelOpen(true)}
          onRequestReview={() => setRequestOpen(true)}
          onRequestChanges={() => setChangesOpen(true)}
          onApprove={() => setApproveOpen(true)}
          onWithdraw={() => setWithdrawOpen(true)}
          onDiscard={() => setDiscardOpen(true)}
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
          await run(
            () => withdrawRequest(changeRequest.id),
            t('Request withdrawn. Your changes are editable again.'),
          );
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
