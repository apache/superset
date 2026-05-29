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
import { memo, ReactNode } from 'react';
import { css, useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Icons, Tooltip } from '@superset-ui/core/components';
import { ActivityEntityKind, ActivityRecord } from '../types';
import {
  formatVersionDate,
  formatVersionUser,
} from '../utils/formatVersionUser';

interface Props {
  record: ActivityRecord;
}

const ENTITY_ICONS: Record<ActivityEntityKind, ReactNode> = {
  dashboard: <Icons.AppstoreOutlined iconSize="m" />,
  chart: <Icons.LineChartOutlined iconSize="m" />,
  dataset: <Icons.DatabaseOutlined iconSize="m" />,
};

function entityIcon(kind: ActivityRecord['entity_kind']): ReactNode {
  return ENTITY_ICONS[kind] ?? <Icons.AppstoreOutlined iconSize="m" />;
}

/** Best-effort entity label. Prefers the backend-supplied ``summary`` so
 * server-side i18n / verbiage stays in sync; falls back to a
 * "<Kind> updated: <name>" reconstruction if the backend omits it. */
function entityLabel(record: ActivityRecord): string {
  if (record.summary) return record.summary;
  const kindWord =
    record.entity_kind.charAt(0).toUpperCase() + record.entity_kind.slice(1);
  return `${kindWord} updated: ${record.entity_name}`;
}

/**
 * Standalone timeline row for ``source: 'related'`` records — upstream
 * changes to a different entity that affect the one being viewed (e.g. a
 * dataset edit that ripples into charts on this dashboard).
 *
 * Not selectable for preview, no actions menu — informational only per
 * the V1 Activity View design.
 */
const RelatedItemRow = ({ record }: Props) => {
  const theme = useTheme();
  const deleted = record.entity_deleted;
  const label = entityLabel(record);
  const displayLabel = deleted ? t('(deleted) %(label)s', { label }) : label;
  const impactCharts = record.impact?.charts ?? 0;

  return (
    <div
      data-test="version-history-related-item"
      css={css`
        display: flex;
        gap: ${theme.sizeUnit * 2}px;
        padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
        background: transparent;
        border-left: 3px solid transparent;
        color: ${deleted ? theme.colorTextTertiary : theme.colorText};
      `}
    >
      <div
        aria-hidden
        css={css`
          color: ${theme.colorIcon};
          display: inline-flex;
          align-items: center;
        `}
      >
        {entityIcon(record.entity_kind)}
      </div>
      <div
        css={css`
          flex: 1;
          min-width: 0;
        `}
      >
        <div
          css={css`
            display: flex;
            align-items: center;
            gap: ${theme.sizeUnit}px;
            font-weight: ${theme.fontWeightStrong};
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-style: ${deleted ? 'italic' : 'normal'};
          `}
          title={displayLabel}
        >
          <span
            css={css`
              overflow: hidden;
              text-overflow: ellipsis;
            `}
          >
            {displayLabel}
          </span>
          {impactCharts > 0 && (
            <Tooltip
              title={t('This affected %(count)s charts', {
                count: impactCharts,
              })}
            >
              <span
                role="img"
                aria-label={t('Impact: %(count)s charts', {
                  count: impactCharts,
                })}
                css={css`
                  display: inline-flex;
                  color: ${theme.colorIcon};
                `}
              >
                <Icons.InfoCircleOutlined iconSize="s" />
              </span>
            </Tooltip>
          )}
        </div>
        <div
          css={css`
            display: flex;
            align-items: center;
            gap: ${theme.sizeUnit}px;
            font-size: ${theme.fontSizeSM}px;
            color: ${theme.colorTextSecondary};
          `}
        >
          <span>
            {formatVersionUser(record.changed_by)} ·{' '}
            {formatVersionDate(record.issued_at)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default memo(RelatedItemRow);
