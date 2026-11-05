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
import { useMemo } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Alert } from '@apache-superset/core/components';
import { Button, Switch } from '@superset-ui/core/components';
import { ago, age, assetUrl, changeCount, isStale, namesOf } from './display';
import { displayName } from './types';
import type { ChangeRequest } from './types';

const ShowChanges = styled.label`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    margin-right: ${theme.sizeUnit * 2}px;
    white-space: nowrap;
    cursor: pointer;
  `}
`;

/**
 * The message and its controls, as one wrapping row.
 *
 * They used to be the Alert's `message` and `action`, which antd lays out as
 * siblings in a non-wrapping flex row. The controls never shrink below their
 * content, so the message got whatever width they left over. A draft carries
 * a switch and three buttons (about 500px), and Explore gives the banner
 * roughly 480-630px at common window widths, so the message was squeezed to
 * a column a few characters wide and the banner grew several hundred pixels
 * tall. Here the message takes a line of its own as soon as the controls do
 * not fit beside it, and the controls wrap among themselves if even a line
 * to themselves is too narrow.
 */
const Row = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
  `}
`;

const Message = styled.div`
  ${({ theme }) => `
    flex: 1 1 ${theme.sizeUnit * 100}px;
    min-width: 0;
    overflow-wrap: anywhere;
  `}
`;

const Actions = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: ${theme.sizeUnit * 2}px;
    margin-left: auto;
  `}
`;

export interface ReviewBannerProps {
  /**
   * The host is in edit mode with unsaved edits on screen.
   *
   * The draft wording talks about what is published versus what is saved,
   * and neither describes a half-finished edit nobody has saved yet. Said
   * to somebody mid-edit it is simply untrue.
   */
  /** The host is in edit mode. */
  editing?: boolean;
  editingUnsaved?: boolean;
  changeRequest: ChangeRequest;
  /** Omitted when this asset kind has no in-place preview. */
  showChanges?: {
    showing: boolean;
    busy: boolean;
    toggle: (next: boolean) => void;
  };
  /** Open the side panel listing what changed. */
  onShowWhatChanged: () => void;
  onRequestReview?: () => void;
  onWithdraw?: () => void;
  onApprove?: () => void;
  onRequestChanges?: () => void;
  onDiscard?: () => void;
  busy?: boolean;
}

interface BannerContent {
  message: string;
  type: 'info' | 'warning' | 'success';
  actions: {
    key: string;
    label: string;
    onClick?: () => void;
    href?: string;
    danger?: boolean;
  }[];
}

/**
 * The banner on a governed asset with an open change.
 *
 * Which banner you see is a function of your relationship to the change,
 * not of a mode you switch into: the author sees their own work, an
 * eligible approver sees something to decide, another editor sees why the
 * asset is locked. Viewers never reach this component at all -- the API
 * returns nothing for them (SOW 5.5, Visa Q6), so there is no branch here
 * that could leak the existence of a pending change.
 */
export default function ReviewBanner({
  changeRequest,
  showChanges,
  onShowWhatChanged,
  onRequestReview,
  onWithdraw,
  onApprove,
  onRequestChanges,
  onDiscard,
  busy = false,
  editing = false,
  editingUnsaved = false,
}: ReviewBannerProps) {
  const content = useMemo<BannerContent>(() => {
    const {
      status,
      is_author: isAuthor,
      can_approve: canApprove,
    } = changeRequest;
    const author = displayName(changeRequest.author);
    const whatChanged = {
      key: 'what-changed',
      label: t('What changed'),
      onClick: onShowWhatChanged,
    };
    // SOW 5.3 asks a reviewer be able to open the current version in a new
    // tab for side-by-side comparison. Show changes previews the proposal
    // in place; this is the other half of that comparison, and the mocks
    // put it in the banner rather than behind a menu.
    const openLive = {
      key: 'open-live',
      label: t('Open live version'),
      href: assetUrl(changeRequest),
    };

    // Approved, and the author has not been told. The server only sends a
    // decided request back to its own author, and only briefly -- see
    // RECENTLY_DECIDED. Informational: there is nothing left to act on.
    // Guarded on the author as well as the status: the server only sends a
    // decided request to its own author, and anything else falls through to
    // the ordinary branches rather than inventing a state for it.
    if (status === 'approved' && isAuthor) {
      return {
        type: 'success',
        message: changeRequest.reviewer
          ? t(
              '%s approved your change · it is live for viewers',
              displayName(changeRequest.reviewer),
            )
          : t('Your change was approved · it is live for viewers'),
        actions: [whatChanged],
      };
    }

    if (status === 'changes_requested') {
      if (isAuthor) {
        const note = changeRequest.review_note?.trim();
        const reviewer = displayName(changeRequest.reviewer) || t('A reviewer');
        return {
          type: 'warning',
          // The note is required of a reviewer today
          // (`ReviewNoteRequiredError`), so the second form is for rows
          // written before that rule. Said without the empty pair of
          // quotes the `?? ''` used to leave behind.
          message: note
            ? t('%s requested changes · "%s"', reviewer, note)
            : t('%s requested changes', reviewer),
          // The author's way back. This branch offered What changed alone,
          // so an author asked to revise could read the request and had no
          // route to answer it: the toolbar's Request review wanted
          // `status === 'draft'`, and so a returned change with nothing
          // unsaved was a dead end on both surfaces until the author
          // happened to save something.
          //
          // Offered without requiring a fresh edit. `lifecycle.submit`
          // accepts CHANGES_REQUESTED exactly as it accepts DRAFT, the
          // Approvals list has always offered Request review on the same
          // row (`canSubmit`), and whether a change still proposes
          // anything is the server's question, not this banner's
          // (`NothingToReviewError`). A reviewer who asked something the
          // author answers in the submission note has not asked for the
          // content to move.
          //
          // Discard comes with it for the same reason it is on the draft
          // branch: the alternative to answering a review is abandoning
          // the change, and the author should not have to go looking for
          // that in a menu.
          actions: [
            whatChanged,
            {
              key: 'request-review',
              label: t('Request review'),
              onClick: onRequestReview,
            },
            ...(onDiscard
              ? [
                  {
                    key: 'discard',
                    label: t('Discard changes…'),
                    onClick: onDiscard,
                    danger: true,
                  },
                ]
              : []),
          ],
        };
      }
      // Another editor, including whoever sent it back. The change was
      // submitted and returned, so it must not read as never submitted --
      // the author is working on it, not sitting on an untouched draft.
      return {
        type: 'info',
        message: t(
          '%s is updating this after a review · changes requested %s',
          author,
          ago(changeRequest.decided_at),
        ),
        actions: [whatChanged],
      };
    }

    if (status === 'pending') {
      if (canApprove) {
        return {
          type: 'info',
          // Which version is on screen, not just whose change it is. The
          // reviewer's line used to read the same with the switch on and
          // off, so the one persistent statement at the top of the page
          // could not be used to tell the two apart -- and the costly
          // mistake is the quiet one: approving the live chart without
          // ever having turned the switch on.
          message: showChanges?.showing
            ? t(
                '%s proposed %s · you are seeing the proposal',
                author,
                changeCount(changeRequest),
              )
            : t(
                '%s proposed %s · you are seeing the live version',
                author,
                changeCount(changeRequest),
              ),
          // Approve and Request changes live in the review panel's
          // footer, beside the list of what they apply to (mocks 9, 10).
          // Deciding from the banner meant deciding above a list you had
          // to open separately and scroll.
          actions: [whatChanged, openLive],
        };
      }
      if (isAuthor) {
        // Amber once it has been waiting a while. Nothing expires
        // (Visa Q8); this is a nudge, not a deadline.
        //
        // Says which version is on screen, as the reviewer's branch below
        // already does. It used to be one sentence whatever the switch
        // said, which was harmless while the author defaulted to the live
        // asset -- there was only one thing it could be. Now that they
        // open on their own changes, the commonest case is an author
        // looking at their proposal under a banner that never mentions it,
        // beside a header pill reading Published for a dashboard viewers
        // cannot see.
        //
        // In edit mode the switch is not the source. It is withheld
        // entirely while editing (it re-hydrates the dashboard and would
        // throw unsaved edits away), so `showChanges?.showing` is false
        // there whatever is on the canvas -- and the canvas in the editor
        // is the author's own work, not the published asset. The author
        // now stays in the editor through a captured save and on through
        // the submit, so this is the state they are in immediately after
        // pressing Request review, being told they are looking at the live
        // version of a dashboard whose deleted row is missing in front of
        // them.
        const onScreen = editingUnsaved
          ? t('you are seeing your unsaved edits')
          : editing || showChanges?.showing
            ? t('you are seeing your changes')
            : t('you are seeing the live version');
        return {
          type: isStale(changeRequest) ? 'warning' : 'info',
          message: t(
            'Awaiting review · waiting %s · %s can approve · %s',
            age(changeRequest.submitted_at),
            namesOf(changeRequest.eligible_approvers) || t('another editor'),
            onScreen,
          ),
          actions: [
            whatChanged,
            { key: 'withdraw', label: t('Edit'), onClick: onWithdraw },
          ],
        };
      }
      // Another editor, who cannot approve this one.
      return {
        type: 'info',
        message: t(
          '%s has changes awaiting review · %s',
          author,
          changeCount(changeRequest),
        ),
        actions: [whatChanged, openLive],
      };
    }

    // Draft.
    if (isAuthor) {
      // Mid-edit, nothing of this on screen is what the message below
      // describes. "Your changes are saved" is about the draft, and the
      // author is looking at edits that are not in it yet; "viewers are
      // seeing the live version" is true but answers a question they are
      // not asking. Say what is on screen and what it would take to keep
      // it, and leave the draft's own wording for when the draft is what
      // they are looking at.
      if (editingUnsaved) {
        return {
          type: 'info',
          message: t(
            'Editing · these edits are not saved yet · your draft from %s is still what is held for review',
            ago(changeRequest.changed_on),
          ),
          actions: [whatChanged],
        };
      }

      // What is actually on screen, not what exists. The author sees the
      // live asset until they turn Show changes on, and saying "Viewing
      // your changes" before then told them the opposite of the truth
      // (QA-19). The switch is in this same banner, so the message can
      // point at it rather than leave them hunting.
      const authorActions = [
        whatChanged,
        {
          key: 'request-review',
          label: t('Request review'),
          onClick: onRequestReview,
        },
        // The author's own way out, where the banner has just told them
        // they have changes pending.
        //
        // It existed only in the ⋯ menu and only while editing, so the way
        // to abandon a draft was to first enter edit mode on it -- which is
        // the thing somebody abandoning it is trying not to do. Two testers
        // opened a stale draft they did not recognise, looked for a discard,
        // found none, and carried on editing on top of it. Another editor
        // looking at the same draft was offered this all along.
        ...(onDiscard
          ? [
              {
                key: 'discard',
                label: t('Discard changes…'),
                onClick: onDiscard,
                danger: true,
              },
            ]
          : []),
      ];

      // In edit mode with nothing outstanding: the author has just saved,
      // and the canvas in front of them IS the draft. The live-version
      // wording below would be false here -- it describes a page showing
      // the published asset, which this is not.
      //
      // The author stays in edit mode through a captured save now (mocks,
      // author screen 1b), so this state lasts as long as they keep
      // working rather than for the instant before being thrown out of
      // the editor. That makes it a state they can sit in, which is why it
      // carries the same actions as the view-mode draft below rather than
      // What changed alone: an author who has just saved is exactly who
      // wants Request review, and dropping Discard here would put back the
      // dead end it was added to remove -- a stale draft on screen with no
      // way to abandon it except to keep editing on top of it.
      if (editing) {
        return {
          type: 'info',
          message: t(
            'Viewing your changes · saved %s · viewers still see the live version',
            ago(changeRequest.changed_on),
          ),
          actions: authorActions,
        };
      }

      // The only case where the author really is looking at their own work.
      if (showChanges?.showing) {
        return {
          type: 'info',
          message: t(
            'Viewing your changes · saved %s · viewers still see the live version',
            ago(changeRequest.changed_on),
          ),
          actions: authorActions,
        };
      }

      // Otherwise the live asset is on screen, and an absent `showChanges`
      // means there is no in-place preview to turn on, so there is also no
      // switch to point them at.
      //
      // It used to be read the other way -- no preview needed, so the author
      // must already be looking at their draft -- which was observed false
      // for a chart: `canPreview` requires a dashboard, and after a held
      // save Explore reloads the live slice, so the author was told they
      // were viewing changes that were nowhere on screen (sc-131032).
      //
      // `canPreview` is also false for a dataset and for a dashboard's
      // command-type changes (filters, colours, customization), which this
      // branch therefore covers too. Only the chart case was checked
      // against a running instance; for the others this wording is at worst
      // no less true than the claim it replaces.
      return {
        type: 'info',
        message: showChanges
          ? t(
              'Your changes are saved %s · you and viewers are both seeing the live version · turn on Show changes to see yours',
              ago(changeRequest.changed_on),
            )
          : t(
              'Your changes are saved %s · you and viewers are both seeing the live version',
              ago(changeRequest.changed_on),
            ),
        actions: authorActions,
      };
    }

    // Another editor looking at someone's unsubmitted draft. They see the
    // live version; this explains why they cannot edit (SOW 5.5).
    return {
      type: 'info',
      message: t(
        '%s has changes in progress · last saved %s · not submitted yet',
        author,
        ago(changeRequest.changed_on),
      ),
      actions: [
        whatChanged,
        {
          key: 'discard',
          label: t('Discard changes…'),
          onClick: onDiscard,
          danger: true,
        },
      ],
    };
  }, [
    editing,
    editingUnsaved,
    changeRequest,
    showChanges,
    onApprove,
    onDiscard,
    onRequestChanges,
    onRequestReview,
    onShowWhatChanged,
    onWithdraw,
  ]);

  return (
    <Alert
      type={content.type}
      closable={false}
      showIcon
      message={
        <Row>
          <Message>{content.message}</Message>
          <Actions>
            {showChanges ? (
              <ShowChanges>
                <Switch
                  size="small"
                  checked={showChanges.showing}
                  disabled={showChanges.busy}
                  onChange={showChanges.toggle}
                  aria-label={t('Show changes')}
                  data-test="show-changes-switch"
                />
                <span>{t('Show changes')}</span>
              </ShowChanges>
            ) : null}
            {content.actions
              .filter(a => a.onClick || a.href)
              .map(a => (
                <Button
                  key={a.key}
                  buttonStyle={a.key === 'approve' ? 'primary' : 'secondary'}
                  buttonSize="small"
                  danger={a.danger}
                  disabled={busy && !a.href}
                  onClick={a.onClick}
                  {...(a.href
                    ? {
                        href: a.href,
                        // No `target`. SOW 5.3 wants the live version reachable
                        // for a side-by-side read, and a real `href` still gives
                        // that to a middle- or ctrl-click. Forcing every plain
                        // click into a new tab broke the embedded case, where
                        // the new tab leaves the host app and lands on the raw
                        // Superset origin (QA-22).
                        rel: 'noopener noreferrer',
                      }
                    : {})}
                >
                  {a.label}
                </Button>
              ))}
          </Actions>
        </Row>
      }
    />
  );
}
