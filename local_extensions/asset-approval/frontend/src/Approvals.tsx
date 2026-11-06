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
 * @fileoverview The Approvals list, built to mock 16a.
 *
 * The mock asks for "a normal Superset list page (same ListView as Alerts &
 * reports or Recently archived), not an inbox", reusing ListView, SubMenu and
 * Tag. None of those is reachable from an extension: Module Federation shares
 * a module by its exact request, so `@superset-ui/core/components` is not
 * shared even though `@superset-ui/core` is. The table below is antd's,
 * shaped to the mock -- same columns, same wording, same filters, same
 * pagination -- which is as close as a contributed page can currently get.
 *
 * Three things follow the mock rather than the earlier implementation:
 * status is written from the reader's point of view ("Needs your review",
 * "Returned to you") instead of the record's; "From" carries an avatar; and
 * the Show / Type / From filters are real controls rather than four links.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { pages, theme, translation } from '@apache-superset/core';
import { Alert, Avatar, Input, Select, Table, Tag } from 'antd';
import { Button, useToasts } from './host';
import {
  approveChange,
  fetchChangeRequest,
  fetchApprovalsPage,
  refusalMessage,
  requestChanges,
  submitForReview,
} from './api';
import ApprovePublishModal from './ApprovePublishModal';
import DatasetReviewModal from './DatasetReviewModal';
import RequestChangesModal from './RequestChangesModal';
import RequestReviewModal from './RequestReviewModal';
import { age, ago, assetUrl, isStale } from './display';
import { displayName } from './types';
import type { ApprovalsView, ChangeRequest } from './types';

const { t } = translation;
const { styled } = theme;

const Page = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 6}px ${theme.sizeUnit * 8}px;
  `}
`;

const Title = styled.h1`
  ${({ theme }) => `
    font-size: ${theme.fontSizeXL}px;
    font-weight: ${theme.fontWeightStrong};
    margin: 0 0 ${theme.sizeUnit * 5}px 0;
  `}
`;

/** The filter bar, in the mock's order: Name, Show, Type, From. */
const Filters = styled.div`
  ${({ theme }) => `
    display: flex;
    gap: ${theme.sizeUnit * 4}px;
    margin-bottom: ${theme.sizeUnit * 4}px;
    flex-wrap: wrap;
    label {
      display: block;
      color: ${theme.colorTextTertiary};
      font-size: ${theme.fontSizeSM}px;
      margin-bottom: ${theme.sizeUnit}px;
    }
  `}
`;

const Waiting = styled.span<{ stale: boolean }>`
  ${({ theme, stale }) => `
    color: ${stale ? theme.colorWarningText : theme.colorText};
    font-weight: ${stale ? theme.fontWeightStrong : theme.fontWeightNormal};
  `}
`;

/**
 * A line beside a row's action, for something the reader needs *before*
 * they press it. Amber rather than danger: the row is still approvable, it
 * just will not publish as things stand (QA-07).
 */
const ActionNote = styled.div`
  ${({ theme }) => `
    color: ${theme.colorWarningText};
    font-size: ${theme.fontSizeSM}px;
    margin-top: ${theme.sizeUnit}px;
    max-width: 260px;
  `}
`;

/**
 * The reviewer's instruction, under the status tag that announces it.
 *
 * Clamped to two lines, with the whole of it in `title`: a reviewer writes
 * a paragraph, and a row that grows to fit one stops being a list.
 */
const ReturnedNote = styled.div`
  ${({ theme }) => `
    color: ${theme.colorTextSecondary};
    font-size: ${theme.fontSizeSM}px;
    margin-top: ${theme.sizeUnit}px;
    max-width: 320px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  `}
`;

const NoNote = styled.div`
  ${({ theme }) => `
    color: ${theme.colorTextTertiary};
    font-size: ${theme.fontSizeSM}px;
    margin-top: ${theme.sizeUnit}px;
    max-width: 320px;
  `}
`;

const From = styled.span`
  ${({ theme }) => `
    display: inline-flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

const VIEWS: { value: ApprovalsView; label: string }[] = [
  { value: 'for_me', label: t('For me') },
  { value: 'submitted_by_me', label: t('Submitted by me') },
  { value: 'recently_decided', label: t('Recently decided') },
  { value: 'all_pending', label: t('All pending') },
];

/**
 * How many requests a page of the list holds.
 *
 * Matches the server's own default so the first load does not ask for one
 * size and get another.
 */
const PAGE_SIZE = 25;

const EMPTY_COPY: Record<ApprovalsView, string> = {
  for_me: t('Nothing needs you right now'),
  submitted_by_me: t('You have no changes in flight'),
  recently_decided: t('No review activity in the last 30 days'),
  all_pending: t('Nothing is awaiting review'),
};

const TYPES = ['dashboard', 'chart', 'dataset'];

/** Capitalised for the Type column, as the mock writes them. */
const typeLabel = (assetType: string) =>
  assetType.charAt(0).toUpperCase() + assetType.slice(1);

/**
 * The status as it reads to the person looking at it.
 *
 * The mock writes "Needs your review" and "Returned to you" -- what the row
 * asks of *you* -- rather than the record's own state, which is what the
 * stored status holds and what the earlier table showed.
 */
function statusOf(row: ChangeRequest): { label: string; color: string } {
  if (row.status === 'pending') {
    return row.can_approve
      ? { label: t('Needs your review'), color: 'blue' }
      : { label: t('Awaiting review'), color: 'blue' };
  }
  if (row.status === 'changes_requested') {
    return row.is_author
      ? { label: t('Returned to you'), color: 'orange' }
      : { label: t('Changes requested'), color: 'orange' };
  }
  if (row.status === 'approved') {
    return { label: t('Approved'), color: 'green' };
  }
  if (row.status === 'discarded') {
    return { label: t('Discarded'), color: 'default' };
  }
  return { label: t('Draft'), color: 'default' };
}

/**
 * The reviewer's note, on the row that asks the author to act on it.
 *
 * Keyed on the **status**, never on the note being there. `review_note` is
 * written by `lifecycle.request_changes` and cleared in exactly one place --
 * `gate._update_own_request`, when the author's next save folds into the
 * draft. `submit`, `withdraw` and `approve` all leave it standing, so a
 * request that was sent back and resubmitted still carries the old
 * instruction while it is `pending`, and so can an approved one. Keyed on
 * presence, this line would show a stale instruction under "Awaiting
 * review" or "Approved" as though a reviewer were still asking for it
 * (sc-131033).
 *
 * Shown to everyone who sees the row, not only its author: another editor
 * reading "Changes requested" is owed the reason too.
 */
function returnedNote(row: ChangeRequest) {
  if (row.status !== 'changes_requested') return null;
  const note = row.review_note?.trim();
  const reviewer = row.reviewer?.first_name?.trim() || displayName(row.reviewer);
  if (!note) {
    // `request_changes` refuses a blank note today
    // (`ReviewNoteRequiredError`), so this is only reachable for rows
    // written before that rule. A fallback, not a flow.
    return (
      <NoNote data-test="returned-no-note">
        {reviewer
          ? t('%s sent this back without a note.', reviewer)
          : t('Sent back without a note.')}
      </NoNote>
    );
  }
  return (
    <ReturnedNote data-test="returned-note" title={note}>
      {reviewer ? t('%s: "%s"', reviewer, note) : t('"%s"', note)}
    </ReturnedNote>
  );
}

/** Two initials, as the mock's avatars show. */
const initials = (row: ChangeRequest) =>
  `${row.author?.first_name?.[0] ?? ''}${row.author?.last_name?.[0] ?? ''}`
    .toUpperCase()
    .trim() || '?';

export default function Approvals() {
  const subPath = pages.useSubPath();
  const navigate = pages.useNavigate();
  const [rows, setRows] = useState<ChangeRequest[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [authors, setAuthors] = useState<{ value: number; label: string }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  // What the server is actually filtering by. The input updates on every
  // keystroke and each change is a request, so it is held back a moment.
  const [search, setSearch] = useState('');
  const [assetType, setAssetType] = useState<string | undefined>();
  const [author, setAuthor] = useState<number | undefined>();
  const [reviewing, setReviewing] = useState<ChangeRequest | null>(null);
  const [changesFor, setChangesFor] = useState<ChangeRequest | null>(null);
  const [approving, setApproving] = useState<ChangeRequest | null>(null);
  const [submitting, setSubmitting] = useState<ChangeRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const { addDangerToast } = useToasts();

  const requested = subPath.split('/')[1] ?? '';
  const view =
    VIEWS.find(entry => entry.value.replace(/_/g, '-') === requested)?.value ??
    'for_me';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const answer = await fetchApprovalsPage(view, {
        page,
        pageSize: PAGE_SIZE,
        name: search,
        assetType,
        author,
      });
      setRows(answer.rows);
      setCount(answer.count);
      setAuthors(
        answer.authors.map(person => ({
          value: person.id,
          label: displayName(person),
        })),
      );
    } catch {
      setRows([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [view, page, search, assetType, author]);

  useEffect(() => {
    load();
  }, [load]);

  // Typing is not a page change, so the request waits for a pause in it,
  // and the new search starts again from the first page. Any narrowing
  // does: staying on page 4 of a result set that now has one page shows an
  // empty list that looks broken.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(name);
      setPage(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [name]);

  // The From options and the rows both arrive filtered. Narrowing in the
  // browser would only ever narrow the page the browser is holding, which
  // is a different question from the one the filter appears to ask.

  /**
   * Where a review happens.
   *
   * A dashboard or a chart is reviewed on the asset itself, where the
   * banner and the in-place panel are. A dataset has no page of its own --
   * `assetUrl` can only offer the dataset list -- so it is reviewed here,
   * in the dataset editor's own tabs, read-only. Nor has an archived
   * asset, whatever its kind, so that is decided here too (R3-01).
   */
  /** The server's reason for refusing the last action, shown in the page. */
  const [refusal, setRefusal] = useState<string | null>(null);

  const act = async (run: () => Promise<unknown>) => {
    setBusy(true);
    setRefusal(null);
    try {
      await run();
      setReviewing(null);
      setChangesFor(null);
      setApproving(null);
      setSubmitting(null);
      await load();
    } catch (error) {
      // A refused action said nothing at all: the rejection was left
      // unhandled, so the dialog stayed open over a list that had not
      // moved and the reader was given no reason (R4-04). Every refusal
      // the workflow raises carries a sentence written for them.
      //
      // Said in the page as well as in a toast. The toast here is antd's
      // own, raised from this bundle rather than through the host's
      // Redux-connected toasts (see `host.useToasts`), so it does not
      // always reach the screen the reader is looking at -- which left
      // the commonest refusal of all, approving a request that moved,
      // looking like nothing happened. The page is the surface that
      // cannot miss.
      const reason = (await refusalMessage(error)) ?? t('Something went wrong.');
      setRefusal(reason);
      addDangerToast(reason);
      // Close the dialogs, or the reader never sees either.
      //
      // The alert renders in the page and the dialogs render in a portal
      // above it behind a mask, so leaving them open put the reason
      // underneath them: measured with `elementFromPoint`, the top element
      // at the alert's own centre was the modal, and its close button was
      // unreachable. The screen then looked exactly as it had before the
      // button was pressed -- which is the symptom this was meant to cure.
      //
      // Closing them is also the honest thing. Every refusal here means
      // the request moved out from under this page, so the dialog is bound
      // to a version that is gone and its buttons would fail the same way
      // a second time. A typed note goes with it, which is a real cost,
      // and the lesser one: the note described that version.
      setReviewing(null);
      setChangesFor(null);
      setApproving(null);
      setSubmitting(null);
      // Re-read either way. The commonest refusal is that the request
      // moved while this page had it open, which only becomes actionable
      // once the list shows what it is now.
      await load();
    } finally {
      setBusy(false);
    }
  };

  /**
   * Whether this row is the reader's own, waiting on them to send it.
   *
   * A dashboard or a chart is submitted from its own banner, which is on
   * the asset. A dataset has no page to put a banner on, so without this
   * its author has nowhere to submit from at all -- the row's only other
   * action, Open, leads to the dataset list.
   *
   * `changes_requested` counts too: a change sent back is the author's to
   * send again, by the same route.
   */
  const canSubmit = (row: ChangeRequest) =>
    row.is_author === true &&
    (row.status === 'draft' || row.status === 'changes_requested');

  /**
   * Open the request dialog on the full record, not on the list row.
   *
   * `fetchApprovalsPage` leaves out `eligible_approvers` -- the dialog's whole
   * "who can approve" section reads it, and an absent list is indistinguishable
   * from an empty one, so handing it a row makes it tell an author with a
   * perfectly good reviewer that nobody can approve their change.
   */
  const openSubmit = async (row: ChangeRequest) => {
    try {
      setSubmitting(await fetchChangeRequest(row.id));
    } catch {
      setSubmitting(row);
    }
  };

  const review = (row: ChangeRequest) => {
    if (row.asset_type === 'dataset') {
      setReviewing(row);
      return;
    }
    if (row.asset_archived) {
      // The asset is in the trash, so it has no page to review it on:
      // Explore on an archived chart opens empty, says the dataset is
      // missing, and carries no review controls, so the request could be
      // seen and still not acted on (R3-01). Decided here instead, which
      // is what the dataset rows already do for the same reason.
      //
      // Driven by what the server says about the asset, not by the row's
      // command. The first fix tested `command === 'restore'`, which is
      // only the one case we happened to know about, and any other change
      // about an archived asset walked into the same dead page.
      setApproving(row);
      return;
    }
    window.location.assign(assetUrl(row));
  };

  const columns = [
    {
      title: t('Name'),
      key: 'name',
      render: (_: unknown, row: ChangeRequest) => (
        <a href={assetUrl(row)} data-test="asset-link">
          {row.asset_title ?? `${row.asset_type} ${row.asset_id}`}
        </a>
      ),
    },
    {
      title: t('Type'),
      key: 'type',
      render: (_: unknown, row: ChangeRequest) => typeLabel(row.asset_type),
    },
    {
      title: t('Status'),
      key: 'status',
      render: (_: unknown, row: ChangeRequest) => {
        const status = statusOf(row);
        return (
          <>
            <Tag color={status.color}>{status.label}</Tag>
            {returnedNote(row)}
          </>
        );
      },
    },
    {
      title: t('From'),
      key: 'from',
      render: (_: unknown, row: ChangeRequest) => (
        <From>
          <Avatar size="small">{initials(row)}</Avatar>
          {displayName(row.author)}
        </From>
      ),
    },
    {
      title: t('Waiting'),
      key: 'waiting',
      render: (_: unknown, row: ChangeRequest) =>
        row.status === 'pending' ? (
          // Past three days this turns amber, which is the only thing in the
          // row that says a review has been sitting too long.
          <Waiting stale={isStale(row)}>{age(row.submitted_at)}</Waiting>
        ) : (
          <Waiting stale={false}>{ago(row.decided_at ?? row.changed_on)}</Waiting>
        ),
    },
    {
      title: t('Actions'),
      key: 'actions',
      render: (_: unknown, row: ChangeRequest) => {
        if (row.can_approve) {
          // Approving is refused once the author has lost edit access,
          // because the change publishes as their work -- and the request
          // stays approvable by decision, so `can_approve` still says yes
          // (QA-07). Said on the row, so the reader learns it before
          // pressing the button rather than from the refusal afterwards.
          const authorLostAccess =
            row.is_open && row.author_can_still_edit === false;
          return (
            <>
              <Button
                buttonSize="small"
                onClick={() => review(row)}
                data-test="review-action"
              >
                {t('Review')}
              </Button>
              {authorLostAccess ? (
                <ActionNote data-test="author-lost-access">
                  {t(
                    '%s no longer has edit access, so approving will be refused. Discard it, or restore their access.',
                    displayName(row.author),
                  )}
                </ActionNote>
              ) : null}
            </>
          );
        }
        if (canSubmit(row)) {
          return (
            <Button
              buttonSize="small"
              buttonStyle="primary"
              onClick={() => openSubmit(row)}
              data-test="submit-action"
            >
              {t('Request review')}
            </Button>
          );
        }
        // Nothing for this reader to decide or to send, so the row offers
        // the asset rather than a review they cannot give.
        return (
          <Button
            buttonSize="small"
            href={assetUrl(row)}
            data-test="open-action"
          >
            {t('Open')}
          </Button>
        );
      },
    },
  ];

  return (
    <Page data-test="approvals-page">
      <Title>{t('Approvals')}</Title>

      {refusal ? (
        <Alert
          type="error"
          showIcon
          closable
          message={refusal}
          onClose={() => setRefusal(null)}
          data-test="approvals-refusal"
          style={{ marginBottom: 16 }}
        />
      ) : null}

      <Filters>
        <div>
          <label htmlFor="approvals-name">{t('Name')}</label>
          <Input
            id="approvals-name"
            allowClear
            placeholder={t('Type a value')}
            value={name}
            onChange={event => setName(event.target.value)}
            style={{ width: 220 }}
            data-test="filter-name"
          />
        </div>
        <div>
          <label htmlFor="approvals-show">{t('Show')}</label>
          <Select
            id="approvals-show"
            value={view}
            options={VIEWS}
            onChange={next => {
              setPage(0);
              navigate(`/${String(next).replace(/_/g, '-')}`);
            }}
            style={{ width: 200 }}
            data-test="filter-show"
          />
        </div>
        <div>
          <label htmlFor="approvals-type">{t('Type')}</label>
          <Select
            id="approvals-type"
            allowClear
            placeholder={t('Choose...')}
            value={assetType}
            options={TYPES.map(value => ({ value, label: typeLabel(value) }))}
            onChange={next => {
              setPage(0);
              setAssetType(next as string | undefined);
            }}
            style={{ width: 170 }}
            data-test="filter-type"
          />
        </div>
        <div>
          <label htmlFor="approvals-from">{t('From')}</label>
          <Select
            id="approvals-from"
            allowClear
            placeholder={t('Choose...')}
            value={author}
            options={authors}
            onChange={next => {
              setPage(0);
              setAuthor(next as number | undefined);
            }}
            style={{ width: 200 }}
            data-test="filter-from"
          />
        </div>
      </Filters>

      <Table
        data-test="approvals-table"
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        locale={{ emptyText: EMPTY_COPY[view] }}
        pagination={{
          current: page + 1,
          pageSize: PAGE_SIZE,
          total: count,
          showSizeChanger: false,
          onChange: next => setPage(next - 1),
          showTotal: (total, range) =>
            t('%s–%s of %s', range[0], range[1], total),
        }}
      />

      {reviewing ? (
        <DatasetReviewModal
          changeRequest={reviewing}
          open
          onClose={() => setReviewing(null)}
          review={
            reviewing.can_approve
              ? {
                  busy,
                  // Approving is the only irreversible step, and the
                  // mocks stop to ask before it. Reviewing on the asset
                  // already did; reviewing from here did not.
                  onApprove: () => setApproving(reviewing),
                  onRequestChanges: () => {
                    setChangesFor(reviewing);
                    setReviewing(null);
                  },
                }
              : undefined
          }
        />
      ) : null}

      {submitting ? (
        <RequestReviewModal
          changeRequest={submitting}
          open
          onClose={() => setSubmitting(null)}
          onSubmit={(note, approverId) =>
            act(() => submitForReview(submitting.id, note, approverId))
          }
          onEditorsChanged={async () => {
            // The modal holds its own copy of the request, and who may
            // approve is computed from the editors it was fetched with.
            // Reloading only the list left the author looking at "no one
            // else can approve" after they had just added the person who
            // could.
            try {
              setSubmitting(await fetchChangeRequest(submitting.id));
            } catch {
              // Keep what is on screen rather than closing over an error.
            }
            await load();
          }}
        />
      ) : null}

      {approving ? (
        <ApprovePublishModal
          changeRequest={approving}
          open
          onClose={() => setApproving(null)}
          onConfirm={() =>
            act(() =>
              approveChange(
                approving.id,
                undefined,
                approving.revision ?? approving.changed_on,
              ),
            )
          }
        />
      ) : null}

      {changesFor ? (
        <RequestChangesModal
          changeRequest={changesFor}
          open
          onClose={() => setChangesFor(null)}
          onSubmit={note => act(() => requestChanges(changesFor.id, note))}
        />
      ) : null}
    </Page>
  );
}
