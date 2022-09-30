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

import React, { ReactNode, useCallback, useMemo, useState } from 'react';
import {
  Behavior,
  BinaryQueryObjectFilterClause,
  css,
  getChartMetadataRegistry,
  SqlaFormData,
  styled,
  SupersetTheme,
  t,
} from '@superset-ui/core';
import { Menu } from 'src/components/Menu';
import Icons from 'src/components/Icons';
import { Tooltip } from 'src/components/Tooltip';
import DrillDetailModal from './DrillDetailModal';

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

export type DrillDetailMenuItemsProps = {
  chartId: number;
  formData: SqlaFormData;
  filters: BinaryQueryObjectFilterClause[];
  isContextMenu?: boolean;
  onSelection?: () => void;
  onClick?: (event: MouseEvent) => void;
};

const DrillDetailMenuItems = ({
  chartId,
  formData,
  filters,
  isContextMenu,
  onSelection = () => null,
  onClick = () => null,
  ...props
}: DrillDetailMenuItemsProps) => {
  const [modalFilters, setFilters] = useState<BinaryQueryObjectFilterClause[]>(
    [],
  );

  const [showModal, setShowModal] = useState(false);
  const openModal = useCallback(
    (filters, event) => {
      onClick(event);
      onSelection();
      setFilters(filters);
      setShowModal(true);
    },
    [onClick, onSelection],
  );

  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  //  Check chart plugin metadata to see if the contextmenu event is handled
  //  by the chart plugin or the fallback handler
  const chartHandlesContextMenuEvent = useMemo(
    () =>
      getChartMetadataRegistry()
        .get(formData.viz_type)
        ?.behaviors.find(behavior => behavior === Behavior.DRILL_TO_DETAIL),
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
    <DisabledMenuItem {...props} key="drill-detail-no-aggregations-message">
      {t('Drill to detail')}
      <Tooltip
        title={t(
          'Drill to detail is disabled because this chart does not group data by dimension value.',
        )}
        placement="top"
      >
        <Icons.InfoCircleOutlined
          data-test="no-aggregations-tooltip-trigger"
          css={(theme: SupersetTheme) => css`
            color: ${theme.colors.text.label};
            margin-left: ${theme.gridUnit * 2}px;
            &.anticon {
              font-size: unset;
              .anticon {
                line-height: unset;
                vertical-align: unset;
              }
            }
          `}
        />
      </Tooltip>
    </DisabledMenuItem>
  ) : (
    <Menu.Item
      {...props}
      key="drill-detail-no-filters"
      onClick={openModal.bind(null, [])}
    >
      {t('Drill to detail')}
    </Menu.Item>
  );

  let drillToDetailBy = (
    <DisabledMenuItem {...props} key="drill-detail-filters-disabled-message">
      {t('Drill to detail by value is not yet supported for this chart type.')}
    </DisabledMenuItem>
  );

  if (chartHandlesContextMenuEvent) {
    if (filters?.length) {
      drillToDetailBy = (
        <>
          {filters.map((filter, i) => (
            <Menu.Item
              {...props}
              key={`drill-detail-filter-${i}`}
              onClick={openModal.bind(null, [filter])}
            >
              {`${t('Drill to detail by')} `}
              <Filter>{filter.formattedVal}</Filter>
            </Menu.Item>
          ))}
          {filters.length > 1 && (
            <Menu.Item
              {...props}
              key="drill-detail-filter-all"
              onClick={openModal.bind(null, filters)}
            >
              {`${t('Drill to detail by')} `}
              <Filter>{t('all')}</Filter>
            </Menu.Item>
          )}
        </>
      );
    } else {
      drillToDetailBy = (
        <DisabledMenuItem {...props} key="drill-detail-no-filters-message">
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
        <Menu.SubMenu
          {...props}
          title={t('Drill to detail by')}
          disabled={noAggregations}
        >
          <div data-test="drill-to-detail-by-submenu">{drillToDetailBy}</div>
        </Menu.SubMenu>
      )}
      <DrillDetailModal
        chartId={chartId}
        formData={formData}
        filters={modalFilters}
        showModal={showModal}
        onHideModal={closeModal}
      />
    </>
  );
};

export default DrillDetailMenuItems;
