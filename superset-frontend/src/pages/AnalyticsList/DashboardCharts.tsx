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
import { useEffect, useRef, useState } from 'react';
import {
  isFeatureEnabled,
  FeatureFlag,
  getChartMetadataRegistry,
} from '@superset-ui/core';
import { styled, css, useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { EmptyState, Skeleton } from '@superset-ui/core/components';
import { FacePile, ModifiedInfo, TagsList, TagType } from 'src/components';
import { TagTypeEnum } from 'src/components/Tag/TagType';
import { Icons } from '@superset-ui/core/components/Icons';

import type { ContentItem } from './types';

const chartRegistry = getChartMetadataRegistry();

interface DashboardChartsProps {
  dashboardId: number;
  charts: ContentItem[];
  loading: boolean;
  onRequest: (dashboardId: number) => void;
}

const Wrapper = styled.div`
  max-height: 240px;
  overflow-y: auto;
  /* Pull grid to the td edges so columns align with table headers */
  margin: 0 -16px;
`;

const SubHeader = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    padding: ${theme.sizeUnit * 3}px 16px;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextSecondary};
  `}
`;

const Row = styled.div`
  ${({ theme }) => css`
    display: grid;
    grid-template-columns: 2fr 0.8fr 1fr 1fr 1fr 1fr 1fr;
    align-items: center;
    padding: ${theme.sizeUnit * 3}px 0;
    font-size: ${theme.fontSize}px;
    color: ${theme.colorText};

    & + & {
      border-top: 1px solid ${theme.colorBorderSecondary};
    }

    /* Match antd table cell padding so content aligns with headers */
    > * {
      padding: 0 16px;
    }
  `}
`;

const NameCell = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  padding-left: 16px !important;

  a {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const Cell = styled.span`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

export default function DashboardCharts({
  dashboardId,
  charts,
  loading,
  onRequest,
}: DashboardChartsProps) {
  const theme = useTheme();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [colWidths, setColWidths] = useState<string | undefined>();

  useEffect(() => {
    onRequest(dashboardId);
  }, [dashboardId, onRequest]);

  // Read parent table header widths to align expanded rows with table columns.
  // Re-read on resize so the grid stays aligned when the window changes size.
  useEffect(() => {
    const readWidths = () => {
      const el = wrapperRef.current;
      if (!el) return;
      const table = el.closest('.ant-table-wrapper')?.querySelector('thead tr');
      if (!table) return;
      const ths = Array.from(
        table.querySelectorAll<HTMLTableCellElement>('th'),
      );
      const dataHeaders = ths.filter(th => th.offsetWidth > 40);
      if (dataHeaders.length > 0) {
        setColWidths(dataHeaders.map(th => `${th.offsetWidth}px`).join(' '));
      }
    };
    readWidths();
    window.addEventListener('resize', readWidths);
    return () => window.removeEventListener('resize', readWidths);
  }, [charts.length]);

  if (loading) {
    return <Skeleton active />;
  }

  if (charts.length === 0) {
    return (
      <EmptyState
        size="small"
        description={t('This dashboard has no charts')}
      />
    );
  }

  const showTags = isFeatureEnabled(FeatureFlag.TaggingSystem);

  return (
    <Wrapper ref={wrapperRef}>
      <SubHeader>
        <Icons.LineChartOutlined iconSize="m" />
        {t('Charts in the dashboard (%s)', charts.length)}
      </SubHeader>
      {charts.map(chart => (
        <Row
          key={chart.id}
          style={colWidths ? { gridTemplateColumns: colWidths } : undefined}
        >
          <NameCell>
            <Icons.LineChartOutlined
              iconSize="m"
              css={{ color: theme.colorErrorBorderHover, flexShrink: 0 }}
            />
            {chart.url ? <a href={chart.url}>{chart.name}</a> : chart.name}
          </NameCell>
          <Cell />
          <Cell>
            {chart.viz_type
              ? (chartRegistry.get(chart.viz_type)?.name ?? chart.viz_type)
              : null}
          </Cell>
          <Cell>
            {chart.datasource_name && chart.datasource_url ? (
              <a href={chart.datasource_url}>{chart.datasource_name}</a>
            ) : (
              (chart.datasource_name ?? null)
            )}
          </Cell>
          <Cell>
            {showTags && chart.tags?.length ? (
              <TagsList
                tags={chart.tags.filter(
                  (tag: TagType) =>
                    tag.type === 'TagTypes.custom' ||
                    tag.type === TagTypeEnum.Custom,
                )}
                maxTags={3}
              />
            ) : null}
          </Cell>
          <Cell>
            <FacePile users={chart.owners || []} />
          </Cell>
          <Cell>
            {chart.changed_on_humanized ? (
              <ModifiedInfo
                date={chart.changed_on_humanized}
                user={chart.changed_by ?? undefined}
              />
            ) : (
              '-'
            )}
          </Cell>
        </Row>
      ))}
    </Wrapper>
  );
}
