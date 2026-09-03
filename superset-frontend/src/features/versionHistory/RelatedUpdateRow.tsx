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
import { ComponentType } from 'react';
import { t, tn } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Icons, Tooltip } from '@superset-ui/core/components';
import type { IconType } from '@superset-ui/core/components/Icons/types';
import type { ActivityEntityKind, ActivityRecord } from './types';
import {
  entityDisplayName,
  formatAuthor,
  formatVersionDateTimeShort,
  relatedHeadline,
  relatedRollupHeadline,
} from './display';

const ENTITY_ICON: Record<ActivityEntityKind, ComponentType<IconType>> = {
  chart: Icons.BarChartOutlined,
  dashboard: Icons.DashboardOutlined,
  dataset: Icons.TableOutlined,
};

const Row = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: flex-start;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 2}px 0 ${theme.sizeUnit * 4}px;
    border-bottom: 1px solid ${theme.colorBorderSecondary};
  `}
`;

// The icon centers within the first text line (one line-height tall)
// so it tracks the headline, not the middle of the two-line block.
const IconWrapper = styled.span`
  ${({ theme }) => `
    color: ${theme.colorTextSecondary};
    display: flex;
    align-items: center;
    height: ${theme.fontSize * theme.lineHeight}px;
  `}
`;

const Content = styled.div`
  ${({ theme }) => `
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

const Headline = styled.div`
  ${({ theme }) => `
    font-size: ${theme.fontSize}px;
    line-height: ${theme.lineHeight};
    color: ${theme.colorText};
    overflow-wrap: anywhere;
  `}
`;

const NameLink = styled.button`
  ${({ theme }) => `
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font: inherit;
    color: ${theme.colorPrimary};
    &:hover {
      text-decoration: underline;
    }
  `}
`;

const Meta = styled.div`
  ${({ theme }) => `
    color: ${theme.colorTextTertiary};
    font-size: ${theme.fontSizeSM}px;
    line-height: ${theme.lineHeightSM};
  `}
`;

// Both hover tooltips in this component (rolled-up entity names, impact
// chart names) render the same "list of names with an Untitled fallback"
// shape; one helper keeps them visually identical.
const tooltipNameList = (items: { key: number | string; name: string }[]) =>
  items.map(({ key, name }) => <div key={key}>{name || t('Untitled')}</div>);

export interface RelatedUpdateRowProps {
  record: ActivityRecord;
  /** Entity names when several same-kind entities rolled into this row. */
  rollupEntityNames?: string[];
  onOpen?: (record: ActivityRecord) => void;
}

export default function RelatedUpdateRow({
  record,
  rollupEntityNames,
  onOpen,
}: RelatedUpdateRowProps) {
  const Icon = ENTITY_ICON[record.entity_kind] ?? Icons.FileOutlined;

  if (rollupEntityNames && rollupEntityNames.length > 1) {
    // No single target to link to; a tooltip lists the rolled-up names.
    return (
      <Row data-test="version-history-related-row">
        <IconWrapper>
          <Icon iconSize="l" />
        </IconWrapper>
        <Content>
          <Tooltip
            title={tooltipNameList(
              rollupEntityNames.map((name, index) => ({
                key: `${index}-${name}`,
                name,
              })),
            )}
          >
            <Headline>
              {relatedRollupHeadline(
                record.entity_kind,
                rollupEntityNames.length,
              )}
            </Headline>
          </Tooltip>
          <Meta>
            {formatAuthor(record.changed_by)} ·{' '}
            {formatVersionDateTimeShort(record.issued_at)}
          </Meta>
        </Content>
      </Row>
    );
  }

  const headline = relatedHeadline(record);
  const entityName = entityDisplayName(record);
  // The "Dataset used by N charts updated" phrasing summarizes siblings the
  // row cannot name inline; the impact payload carries them for the hover
  // detail (sc-119775), mirroring the rolled-up-names tooltip above.
  const impactCharts = record.impact?.chart_names ?? [];
  // The server caps the named refs while `charts` keeps the full count;
  // surface the difference as an overflow line.
  const impactOverflow = (record.impact?.charts ?? 0) - impactCharts.length;
  const linkable = !record.entity_deleted && Boolean(onOpen);
  // Both the server summary and the impact-aware phrasing end with the
  // entity name; split it out so the name can render as a link. Records
  // without a name can't be split (the empty string matches anywhere).
  const nameIndex =
    linkable && record.entity_name
      ? headline.lastIndexOf(record.entity_name)
      : -1;

  return (
    <Row data-test="version-history-related-row">
      <IconWrapper>
        <Icon iconSize="l" />
      </IconWrapper>
      <Content>
        <Tooltip
          title={
            impactCharts.length > 0
              ? [
                  ...tooltipNameList(
                    impactCharts.map(chart => ({
                      key: chart.id,
                      name: chart.name,
                    })),
                  ),
                  impactOverflow > 0 && (
                    <div key="impact-overflow">
                      {tn(
                        '…and %s more chart',
                        '…and %s more charts',
                        impactOverflow,
                        impactOverflow,
                      )}
                    </div>
                  ),
                ]
              : null
          }
        >
          <Headline>
            {nameIndex >= 0 ? (
              <>
                {headline.slice(0, nameIndex)}
                <NameLink type="button" onClick={() => onOpen?.(record)}>
                  {entityName}
                </NameLink>
                {headline.slice(nameIndex + record.entity_name.length)}
              </>
            ) : (
              headline
            )}
            {record.entity_deleted && ` (${t('deleted')})`}
          </Headline>
        </Tooltip>
        <Meta>
          {formatAuthor(record.changed_by)} ·{' '}
          {formatVersionDateTimeShort(record.issued_at)}
        </Meta>
      </Content>
    </Row>
  );
}
