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
import { isEmpty } from 'lodash';
import {
  Behavior,
  BinaryQueryObjectFilterClause,
  css,
  extractQueryFields,
  getChartMetadataRegistry,
  QueryFormData,
  styled,
  SupersetTheme,
  t,
} from '@superset-ui/core';
import { Menu } from 'src/components/Menu';
import Icons from 'src/components/Icons';
import { Tooltip } from 'src/components/Tooltip';
import DrillDetailModal from './DrillDetailModal';

const DisabledMenuItemTooltip = ({ title }: { title: ReactNode }) => (
  <Tooltip title={title} placement="top">
    <Icons.InfoCircleOutlined
      data-test="tooltip-trigger"
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
);

const DisabledMenuItem = ({ children, ...props }: { children: ReactNode }) => (
  <Menu.Item disabled {...props}>
    <div
      css={css`
        white-space: normal;
        max-width: 160px;
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
  formData: QueryFormData;
  filters?: BinaryQueryObjectFilterClause[];
  isContextMenu?: boolean;
  onSelection?: () => void;
  onClick?: (event: MouseEvent) => void;
};

const DrillDetailMenuItems = ({
  chartId,
  formData,
  filters = [],
  isContextMenu = false,
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

  // Check for Behavior.DRILL_TO_DETAIL to tell if plugin handles the `contextmenu`
  // event for dimensions.  If it doesn't, tell the user that drill to detail by
  // dimension is not supported.  If it does, and the `contextmenu` handler didn't
  // pass any filters, tell the user that they didn't select a dimension.
  const handlesDimensionContextMenu = useMemo(
    () =>
      getChartMetadataRegistry()
        .get(formData.viz_type)
        ?.behaviors.find(behavior => behavior === Behavior.DRILL_TO_DETAIL),
    [formData.viz_type],
  );

  // Check metrics to see if chart's current configuration lacks
  // aggregations, in which case Drill to Detail should be disabled.
  const noAggregations = useMemo(() => {
    const { metrics } = extractQueryFields(formData);
    return isEmpty(metrics);
  }, [formData]);

  let drillToDetailMenuItem;
  if (handlesDimensionContextMenu && noAggregations) {
    drillToDetailMenuItem = (
      <DisabledMenuItem {...props} key="drill-detail-no-aggregations">
        {t('Drill to detail')}
        <DisabledMenuItemTooltip
          title={t(
            'Drill to detail is disabled because this chart does not group data by dimension value.',
          )}
        />
      </DisabledMenuItem>
    );
  } else {
    drillToDetailMenuItem = (
      <Menu.Item
        {...props}
        key="drill-detail-no-filters"
        onClick={openModal.bind(null, [])}
      >
        {t('Drill to detail')}
      </Menu.Item>
    );
  }

  let drillToDetailByMenuItem;
  if (!handlesDimensionContextMenu) {
    drillToDetailByMenuItem = (
      <DisabledMenuItem {...props} key="drill-detail-by-chart-not-supported">
        {t('Drill to detail by')}
        <DisabledMenuItemTooltip
          title={t(
            'Drill to detail by value is not yet supported for this chart type.',
          )}
        />
      </DisabledMenuItem>
    );
  }

  if (handlesDimensionContextMenu && noAggregations) {
    drillToDetailByMenuItem = (
      <DisabledMenuItem {...props} key="drill-detail-by-no-aggregations">
        {t('Drill to detail by')}
      </DisabledMenuItem>
    );
  }

  if (handlesDimensionContextMenu && !noAggregations && filters?.length) {
    drillToDetailByMenuItem = (
      <Menu.SubMenu {...props} title={t('Drill to detail by')}>
        <div data-test="drill-to-detail-by-submenu">
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
        </div>
      </Menu.SubMenu>
    );
  }

  if (handlesDimensionContextMenu && !noAggregations && !filters?.length) {
    drillToDetailByMenuItem = (
      <DisabledMenuItem {...props} key="drill-detail-by-select-aggregation">
        {t('Drill to detail by')}
        <DisabledMenuItemTooltip
          title={t(
            'Right-click on a dimension value to drill to detail by that value.',
          )}
        />
      </DisabledMenuItem>
    );
  }

  return (
    <>
      {drillToDetailMenuItem}
      {isContextMenu && drillToDetailByMenuItem}
      <DrillDetailModal
        chartId={chartId}
        formData={formData}
        initialFilters={modalFilters}
        showModal={showModal}
        onHideModal={closeModal}
      />
    </>
  );
};

export default DrillDetailMenuItems;
