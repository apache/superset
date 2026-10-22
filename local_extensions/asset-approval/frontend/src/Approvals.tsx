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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { pages, theme, translation } from '@apache-superset/core';
import { Avatar, Input, Select, Table, Tag } from 'antd';
import { Button } from './host';
import {
  approveChange,
  fetchChangeRequest,
  fetchList,
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

/** Two initials, as the mock's avatars show. */
const initials = (row: ChangeRequest) =>
  `${row.author?.first_name?.[0] ?? ''}${row.author?.last_name?.[0] ?? ''}`
    .toUpperCase()
    .trim() || '?';

export default function Approvals() {
  const subPath = pages.useSubPath();
  const navigate = pages.useNavigate();
  const [rows, setRows] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState<string | undefined>();
  const [author, setAuthor] = useState<number | undefined>();
  const [reviewing, setReviewing] = useState<ChangeRequest | null>(null);
  const [changesFor, setChangesFor] = useState<ChangeRequest | null>(null);
  const [approving, setApproving] = useState<ChangeRequest | null>(null);
  const [submitting, setSubmitting] = useState<ChangeRequest | null>(null);
  const [busy, setBusy] = useState(false);

  const requested = subPath.split('/')[1] ?? '';
  const view =
    VIEWS.find(entry => entry.value.replace(/_/g, '-') === requested)?.value ??
    'for_me';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchList(view));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    load();
  }, [load]);

  // The From options are the authors actually present, so the filter can
  // never offer someone with nothing in this view.
  const authors = useMemo(() => {
    const seen = new Map<number, string>();
    rows.forEach(row => {
      if (row.author?.id) seen.set(row.author.id, displayName(row.author));
    });
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        row =>
          (!name ||
            (row.asset_title ?? '').toLowerCase().includes(name.toLowerCase())) &&
          (!assetType || row.asset_type === assetType) &&
          (!author || row.author?.id === author),
      ),
    [rows, name, assetType, author],
  );

  /**
   * Where a review happens.
   *
   * A dashboard or a chart is reviewed on the asset itself, where the
   * banner and the in-place panel are. A dataset has no page of its own --
   * `assetUrl` can only offer the dataset list -- so it is reviewed here,
   * in the dataset editor's own tabs, read-only.
   */
  const act = async (run: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await run();
      setReviewing(null);
      setChangesFor(null);
      setApproving(null);
      setSubmitting(null);
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
   * `fetchList` leaves out `eligible_approvers` -- the dialog's whole
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
        return <Tag color={status.color}>{status.label}</Tag>;
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
          return (
            <Button
              buttonSize="small"
              onClick={() => review(row)}
              data-test="review-action"
            >
              {t('Review')}
            </Button>
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
            onChange={next =>
              navigate(`/${String(next).replace(/_/g, '-')}`)
            }
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
            onChange={setAssetType}
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
            onChange={setAuthor}
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
        dataSource={filtered}
        locale={{ emptyText: EMPTY_COPY[view] }}
        pagination={{
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
          onEditorsChanged={load}
        />
      ) : null}

      {approving ? (
        <ApprovePublishModal
          changeRequest={approving}
          open
          onClose={() => setApproving(null)}
          onConfirm={() => act(() => approveChange(approving.id))}
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
