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
import { useState } from 'react';
import { t, tn } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Modal, Button, Tag } from '@superset-ui/core/components';
import { Alert } from '@apache-superset/core/components';
import { ago, assetUrl } from './display';
import { displayName } from './types';
import type { ChangeRequest, NamedDelta, NamedDiff } from './types';

const Byline = styled.div`
  ${({ theme }) => `
    color: ${theme.colorTextSecondary};
    margin: ${theme.sizeUnit * 3}px 0;
  `}
`;

const Tabs = styled.div`
  ${({ theme }) => `
    display: flex;
    gap: ${theme.sizeUnit * 5}px;
    border-bottom: 1px solid ${theme.colorSplit};
    margin-bottom: ${theme.sizeUnit * 3}px;
  `}
`;

const TabButton = styled.button<{ active: boolean }>`
  ${({ theme, active }) => `
    background: none;
    border: none;
    border-bottom: 2px solid ${active ? theme.colorPrimary : 'transparent'};
    color: ${active ? theme.colorPrimary : theme.colorText};
    font-weight: ${active ? theme.fontWeightStrong : theme.fontWeightNormal};
    padding: ${theme.sizeUnit * 2}px 0;
    cursor: pointer;
  `}
`;

const Count = styled.span`
  ${({ theme }) => `
    display: inline-block;
    min-width: 18px;
    margin-left: ${theme.sizeUnit}px;
    padding: 0 ${theme.sizeUnit}px;
    border-radius: ${theme.borderRadius}px;
    background: ${theme.colorBgLayout};
    color: ${theme.colorTextTertiary};
    font-size: ${theme.fontSizeSM}px;
    text-align: center;
  `}
`;

const Table = styled.table`
  ${({ theme }) => `
    width: 100%;
    border-collapse: collapse;
    th, td {
      text-align: left;
      padding: ${theme.sizeUnit * 2}px;
      border-bottom: 1px solid ${theme.colorSplit};
      vertical-align: top;
    }
    th {
      color: ${theme.colorTextTertiary};
      font-weight: ${theme.fontWeightStrong};
    }
    code {
      font-family: ${theme.fontFamilyCode};
    }
  `}
`;

const Live = styled.td`
  ${({ theme }) => `
    background: ${theme.colorErrorBg};
    color: ${theme.colorTextTertiary};
    text-decoration: line-through;
  `}
`;

const Proposed = styled.td`
  ${({ theme }) => `
    background: ${theme.colorSuccessBg};
    color: ${theme.colorSuccessText};
  `}
`;

const Empty = styled.div`
  ${({ theme }) => `
    color: ${theme.colorTextTertiary};
    padding: ${theme.sizeUnit * 4}px 0;
  `}
`;

const FooterRow = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${theme.sizeUnit * 2}px;
    width: 100%;
  `}
`;

function show(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

interface Row {
  kind: 'Changed' | 'Added' | 'Removed';
  name: string;
  field: string;
  before: unknown;
  after: unknown;
}

/** One row per field that moved, which is what the reviewer decides on. */
function rowsOf(diff?: NamedDiff): Row[] {
  if (!diff) return [];
  const rows: Row[] = [];
  const flatten = (items: NamedDelta[], kind: Row['kind']) =>
    items.forEach(item => {
      const fields = item.fields ?? [];
      if (!fields.length) {
        rows.push({ kind, name: item.name, field: '—', before: null, after: null });
        return;
      }
      fields.forEach(f =>
        rows.push({
          kind,
          name: item.name,
          field: f.field,
          before: f.before,
          after: f.after,
        }),
      );
    });
  flatten(diff.added, 'Added');
  flatten(diff.changed, 'Changed');
  flatten(diff.removed, 'Removed');
  return rows;
}

const TAG_COLOR: Record<Row['kind'], string> = {
  Added: 'green',
  Changed: 'orange',
  Removed: 'red',
};

export interface DatasetReviewModalProps {
  changeRequest: ChangeRequest;
  open: boolean;
  onClose: () => void;
  /** Present only for someone who may decide this one. */
  review?: {
    busy: boolean;
    onApprove: () => void;
    onRequestChanges: () => void;
  };
}

/**
 * A dataset reviewed as a definition (Visa Q11, SOW 5.3).
 *
 * Charts are deliberately not re-rendered against the draft: a dataset
 * change is a change to a contract, and one rendered chart would show a
 * sample of the consequences while implying it was all of them. So the
 * reviewer gets the contract, field by field, with the live value beside
 * the proposed one.
 *
 * Source, Metrics and Columns are the three the gate actually computes.
 * Calculated columns and settings are not separable from the columns diff
 * the backend produces today, so they are not shown as empty tabs -- a
 * tab reading "0" would claim nothing changed there, which is not
 * something this data can support.
 */
export default function DatasetReviewModal({
  changeRequest,
  open,
  onClose,
  review,
}: DatasetReviewModalProps) {
  const detail = changeRequest.dataset_detail;
  const sqlChanged =
    !!detail?.sql && (detail.sql.before ?? '') !== (detail.sql.after ?? '');
  const columnRows = rowsOf(detail?.columns);
  const metricRows = rowsOf(detail?.metrics);

  const tabs = [
    { key: 'source', label: t('Source'), count: sqlChanged ? 1 : 0 },
    { key: 'metrics', label: t('Metrics'), count: metricRows.length },
    { key: 'columns', label: t('Columns'), count: columnRows.length },
  ];
  // Open where the change is. Landing on an empty tab and reading "no
  // column changed" reads as nothing having changed at all.
  const firstWithChanges = tabs.find(entry => entry.count > 0)?.key ?? 'columns';
  const [tab, setTab] = useState(firstWithChanges);

  if (!detail) return null;

  const rows = tab === 'metrics' ? metricRows : tab === 'columns' ? columnRows : [];

  return (
    <Modal
      show={open}
      width="900px"
      title={t('Review dataset changes · %s', changeRequest.asset_title ?? '')}
      onHide={onClose}
      footer={
        <FooterRow>
          <a href={assetUrl(changeRequest)} target="_blank" rel="noopener noreferrer">
            {t('Open live dataset')}
          </a>
          <span>
            {review ? (
              <>
                <Button
                  buttonStyle="danger"
                  disabled={review.busy}
                  onClick={review.onRequestChanges}
                >
                  {t('Request changes')}
                </Button>{' '}
                <Button
                  buttonStyle="primary"
                  disabled={review.busy}
                  onClick={review.onApprove}
                >
                  {t('Approve')}
                </Button>
              </>
            ) : (
              <Button buttonStyle="secondary" onClick={onClose}>
                {t('Close')}
              </Button>
            )}
          </span>
        </FooterRow>
      }
      data-test="dataset-review-modal"
    >
      <Alert
        type="warning"
        showIcon
        closable={false}
        message={t(
          'Used by %s on %s. Changes apply to all of them once approved.',
          tn('%s chart', '%s charts', detail.impact.charts, detail.impact.charts),
          tn(
            '%s dashboard',
            '%s dashboards',
            detail.impact.dashboards,
            detail.impact.dashboards,
          ),
        )}
      />

      <Byline>
        {t(
          '%s · submitted %s',
          displayName(changeRequest.author),
          ago(changeRequest.submitted_at ?? changeRequest.changed_on),
        )}
        {changeRequest.note ? ` · "${changeRequest.note}"` : ''}
      </Byline>

      <Tabs>
        {tabs.map(entry => (
          <TabButton
            key={entry.key}
            active={tab === entry.key}
            onClick={() => setTab(entry.key)}
            data-test={`dataset-tab-${entry.key}`}
          >
            {entry.label}
            <Count>{entry.count}</Count>
          </TabButton>
        ))}
      </Tabs>

      {tab === 'source' ? (
        sqlChanged ? (
          <Table>
            <thead>
              <tr>
                <th>{t('Field')}</th>
                <th>{t('Live')}</th>
                <th>{t('Proposed')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <Tag color="orange">{t('Changed')}</Tag> <code>SQL</code>
                </td>
                <Live>
                  <code>{show(detail.sql?.before)}</code>
                </Live>
                <Proposed>
                  <code>{show(detail.sql?.after)}</code>
                </Proposed>
              </tr>
            </tbody>
          </Table>
        ) : (
          <Empty>{t('The query behind this dataset is unchanged.')}</Empty>
        )
      ) : rows.length ? (
        <Table>
          <thead>
            <tr>
              <th />
              <th>{tab === 'metrics' ? t('Metric') : t('Column')}</th>
              <th>{t('Field')}</th>
              <th>{t('Live')}</th>
              <th>{t('Proposed')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={`${row.kind}-${row.name}-${row.field}`}>
                <td>
                  <Tag color={TAG_COLOR[row.kind]}>{t(row.kind)}</Tag>
                </td>
                <td>
                  <code>{row.name}</code>
                </td>
                <td>{row.field}</td>
                <Live>{show(row.before)}</Live>
                <Proposed>{show(row.after)}</Proposed>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>
          {tab === 'metrics'
            ? t('No metric changed.')
            : t('No column changed.')}
        </Empty>
      )}
    </Modal>
  );
}
