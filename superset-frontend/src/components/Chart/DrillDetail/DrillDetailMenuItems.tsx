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

import React, { ReactNode, useCallback, useContext, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import {
  Behavior,
  QueryObjectFilterClause,
  css,
  getChartMetadataRegistry,
  SqlaFormData,
  styled,
  SupersetTheme,
  t,
  useTheme,
} from '@superset-ui/core';
import { Menu } from 'src/components/Menu';
import ModalTrigger from 'src/components/ModalTrigger';
import Button from 'src/components/Button';
import { useSelector } from 'react-redux';
import { DashboardPageIdContext } from 'src/dashboard/containers/DashboardPage';
import { Slice } from 'src/types/Chart';
import DrillDetailPane from './DrillDetailPane';
import { ContextMenuPayload } from '../types';

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

type ModalFooterProps = {
  exploreChart: () => void;
  closeModal?: () => void;
};

const ModalFooter = ({ exploreChart, closeModal }: ModalFooterProps) => (
  <>
    <Button buttonStyle="secondary" buttonSize="small" onClick={exploreChart}>
      {t('Edit chart')}
    </Button>
    <Button buttonStyle="primary" buttonSize="small" onClick={closeModal}>
      {t('Close')}
    </Button>
  </>
);

export type DrillDetailMenuItemsProps = {
  chartId: number;
  formData: SqlaFormData;
  isContextMenu?: boolean;
  contextPayload?: ContextMenuPayload;
  onSelection?: () => void;
};

export const DrillDetailMenuItems = ({
  chartId,
  formData,
  isContextMenu,
  contextPayload,
  onSelection,
  ...props
}: DrillDetailMenuItemsProps) => {
  const theme = useTheme();
  const history = useHistory();
  const dashboardPageId = useContext(DashboardPageIdContext);
  const { slice_name: chartName } = useSelector(
    (state: { sliceEntities: { slices: Record<number, Slice> } }) =>
      state.sliceEntities.slices[chartId],
  );

  const exploreUrl = useMemo(
    () => `/explore/?dashboard_page_id=${dashboardPageId}&slice_id=${chartId}`,
    [chartId, dashboardPageId],
  );

  const exploreChart = useCallback(() => {
    history.push(exploreUrl);
  }, [exploreUrl, history]);

  const getMenuItem = useCallback(
    (key: string, content: ReactNode, filters?: QueryObjectFilterClause[]) => (
      <Menu.Item
        key={`drill-to-detail-${key}`}
        onClick={onSelection}
        {...props}
      >
        <ModalTrigger
          css={css`
            .ant-modal-body {
              display: flex;
              flex-direction: column;
            }
          `}
          modalTitle={t('Drill to detail: %s', chartName)}
          triggerNode={content}
          modalFooter={<ModalFooter exploreChart={exploreChart} />}
          modalBody={
            <DrillDetailPane formData={formData} initialFilters={filters} />
          }
          responsive
          resizable
          resizableConfig={{
            minHeight: theme.gridUnit * 128,
            minWidth: theme.gridUnit * 128,
            defaultSize: {
              width: 'auto',
              height: '75vh',
            },
          }}
          draggable
        />
      </Menu.Item>
    ),
    [chartName, exploreChart, formData, onSelection, props, theme.gridUnit],
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
    getMenuItem('no-filters', t('Drill to detail'))
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
          {contextPayload.filters.map((filter, i) =>
            getMenuItem(
              `filter-${i}`,
              <>
                {`${t('Drill to detail by')} `}
                <Filter>{filter.formattedVal}</Filter>)
              </>,
              [filter],
            ),
          )}
          {contextPayload.filters.length > 1 &&
            getMenuItem(
              'filters-all',
              <>
                {`${t('Drill to detail by')} `}
                <Filter>{t('all')}</Filter>
              </>,
              contextPayload.filters,
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
