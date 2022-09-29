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

import React, { ReactNode, useMemo } from 'react';
import {
  Behavior,
  QueryObjectFilterClause,
  css,
  getChartMetadataRegistry,
  SqlaFormData,
  styled,
  SupersetTheme,
  t,
} from '@superset-ui/core';
import { Menu } from 'src/components/Menu';
import { ContextMenuPayload } from '../types';
import DrillDetailModalTrigger from './DrillDetailModalTrigger';

const DisabledMenuItem = ({ children, ...props }: { children: ReactNode }) => (
  <Menu.Item disabled {...props}>
    <div
      css={(theme: SupersetTheme) => css`
        white-space: normal;
        max-width: ${theme.gridUnit * 40}px;
      `}
    >
      {children}
    </div>
  </Menu.Item>
);

const Filter = styled.span`
  ${({ theme }) => `
    font-weight: ${theme.typography.weights.bold};
    color: ${theme.colors.primary.base};
  `}
`;

export interface DrillDetailMenuItemsProps {
  chartId: number;
  formData: SqlaFormData;
  isContextMenu?: boolean;
  contextPayload?: ContextMenuPayload;
  onSelection?: () => void;
}

export const DrillDetailMenuItems = ({
  chartId,
  formData,
  isContextMenu,
  contextPayload,
  onSelection,
  ...props
}: DrillDetailMenuItemsProps) => {
  const ModalTriggerMenuItem = ({
    filters,
    children,
    ...props
  }: {
    filters?: QueryObjectFilterClause[];
    children: ReactNode;
  }) => (
    <Menu.Item onClick={onSelection} {...props}>
      <DrillDetailModalTrigger
        chartId={chartId}
        formData={formData}
        filters={filters}
      >
        {children}
      </DrillDetailModalTrigger>
    </Menu.Item>
  );

  //  Check chart plugin metadata to see if the contextmenu event is handled
  //  by the chart plugin or the fallback handler
  const chartHandlesContextMenuEvent = useMemo(
    () =>
      getChartMetadataRegistry()
        .get(formData.viz_type)
        ?.behaviors.find(behavior => behavior === Behavior.CONTEXT_MENU),
    [formData.viz_type],
  );

  //  Check chart plugin metadata to see if chart's current configuration lacks
  //  aggregations, in which case Drill to Detail should be disabled
  const noAggregations = useMemo(
    () =>
      getChartMetadataRegistry()
        .get(formData.viz_type)
        ?.noAggregations?.(formData) ?? false,
    [formData],
  );

  const drillToDetail = noAggregations ? (
    <DisabledMenuItem key="no-aggregations-message" {...props}>
      {t(
        'Drill to detail is disabled because this chart does not group data by dimension value.',
      )}
    </DisabledMenuItem>
  ) : (
    <ModalTriggerMenuItem key="no-filters" {...props}>
      {t('Drill to detail')}
    </ModalTriggerMenuItem>
  );

  let drillToDetailBy = (
    <DisabledMenuItem key="filters-disabled" {...props}>
      {t('Drill to detail by value is not yet supported for this chart type.')}
    </DisabledMenuItem>
  );

  if (chartHandlesContextMenuEvent) {
    if (contextPayload?.filters.length) {
      drillToDetailBy = (
        <>
          {contextPayload.filters.map((filter, i) => (
            <ModalTriggerMenuItem
              key={`filter-${i}`}
              filters={[filter]}
              {...props}
            >
              {`${t('Drill to detail by')} `}
              <Filter>{filter.formattedVal}</Filter>
            </ModalTriggerMenuItem>
          ))}
          {contextPayload.filters.length > 1 && (
            <ModalTriggerMenuItem
              key="filters-all"
              filters={contextPayload.filters}
              {...props}
            >
              {`${t('Drill to detail by')} `}
              <Filter>{t('all')}</Filter>
            </ModalTriggerMenuItem>
          )}
        </>
      );
    } else {
      drillToDetailBy = (
        <DisabledMenuItem key="no-filters-message" {...props}>
          {t(
            'Right-click on a dimension value to drill to detail by that value.',
          )}
        </DisabledMenuItem>
      );
    }
  }

  return (
    <>
      {drillToDetail}
      {isContextMenu && (
        <Menu.SubMenu title={t('Drill to detail by')} {...props}>
          <div data-test="drill-to-detail-by-submenu">{drillToDetailBy}</div>
        </Menu.SubMenu>
      )}
    </>
  );
};
