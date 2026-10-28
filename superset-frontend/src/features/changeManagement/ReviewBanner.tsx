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

const Actions = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

export interface ReviewBannerProps {
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

    if (status === 'changes_requested') {
      if (isAuthor) {
        return {
          type: 'warning',
          message: t(
            '%s requested changes · "%s"',
            displayName(changeRequest.reviewer),
            changeRequest.review_note ?? '',
          ),
          actions: [whatChanged],
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
          message: t(
            'Reviewing changes from %s · %s',
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
        return {
          type: isStale(changeRequest) ? 'warning' : 'info',
          message: t(
            'Awaiting review · waiting %s · %s can approve',
            age(changeRequest.submitted_at),
            namesOf(changeRequest.eligible_approvers) || t('another editor'),
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
      return {
        type: 'info',
        message: t(
          'Viewing your changes · saved %s · viewers still see the live version',
          ago(changeRequest.changed_on),
        ),
        actions: [
          whatChanged,
          {
            key: 'request-review',
            label: t('Request review'),
            onClick: onRequestReview,
          },
        ],
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
    changeRequest,
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
      message={content.message}
      action={
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
      }
    />
  );
}
