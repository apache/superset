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

import { ReactNode, RefObject, useCallback, useMemo, useState } from 'react';
import { isEmpty } from 'lodash';
import {
  Behavior,
  BinaryQueryObjectFilterClause,
  css,
  extractQueryFields,
  getChartMetadataRegistry,
  QueryFormData,
  removeHTMLTags,
  styled,
  t,
} from '@superset-ui/core';
import { useSelector } from 'react-redux';
import { Menu } from 'src/components/Menu';
import { RootState } from 'src/dashboard/types';
import DrillDetailModal from './DrillDetailModal';
import { getSubmenuYOffset } from '../utils';
import { MenuItemTooltip } from '../DisabledMenuItemTooltip';
import { MenuItemWithTruncation } from '../MenuItemWithTruncation';

const DRILL_TO_DETAIL = t('Drill to detail');
const DRILL_TO_DETAIL_BY = t('Drill to detail by');
const DISABLED_REASONS = {
  DATABASE: t(
    'Drill to detail is disabled for this database. Change the database settings to enable it.',
  ),
  NO_AGGREGATIONS: t(
    'Drill to detail is disabled because this chart does not group data by dimension value.',
  ),
  NO_FILTERS: t(
    'Right-click on a dimension value to drill to detail by that value.',
  ),
  NOT_SUPPORTED: t(
    'Drill to detail by value is not yet supported for this chart type.',
  ),
};

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

const Filter = ({
  children,
  stripHTML = false,
}: {
  children: ReactNode;
  stripHTML: boolean;
}) => {
  const content =
    stripHTML && typeof children === 'string'
      ? removeHTMLTags(children)
      : children;
  return <span>{content}</span>;
};

const StyledFilter = styled(Filter)`
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
  contextMenuY?: number;
  onSelection?: () => void;
  onClick?: (event: MouseEvent) => void;
  submenuIndex?: number;
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  drillToDetailMenuRef?: RefObject<any>;
};

const DrillDetailMenuItems = ({
  chartId,
  formData,
  filters = [],
  isContextMenu = false,
  contextMenuY = 0,
  onSelection = () => null,
  onClick = () => null,
  submenuIndex = 0,
  showModal,
  setShowModal,
  drillToDetailMenuRef,
  ...props
}: DrillDetailMenuItemsProps) => {
  const drillToDetailDisabled = useSelector<RootState, boolean | undefined>(
    ({ datasources }) =>
      datasources[formData.datasource]?.database?.disable_drill_to_detail,
  );

  const [modalFilters, setFilters] = useState<BinaryQueryObjectFilterClause[]>(
    [],
  );

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
        ?.behaviors.find(behavior => behavior === Behavior.DrillToDetail),
    [formData.viz_type],
  );

  // Check metrics to see if chart's current configuration lacks
  // aggregations, in which case Drill to Detail should be disabled.
  const noAggregations = useMemo(() => {
    const { metrics } = extractQueryFields(formData);
    return isEmpty(metrics);
  }, [formData]);

  // Ensure submenu doesn't appear offscreen
  const submenuYOffset = useMemo(
    () =>
      getSubmenuYOffset(
        contextMenuY,
        filters.length > 1 ? filters.length + 1 : filters.length,
        submenuIndex,
      ),
    [contextMenuY, filters.length, submenuIndex],
  );

  let drillDisabled;
  let drillByDisabled;
  if (drillToDetailDisabled) {
    drillDisabled = DISABLED_REASONS.DATABASE;
    drillByDisabled = DISABLED_REASONS.DATABASE;
  } else if (handlesDimensionContextMenu) {
    if (noAggregations) {
      drillDisabled = DISABLED_REASONS.NO_AGGREGATIONS;
      drillByDisabled = DISABLED_REASONS.NO_AGGREGATIONS;
    } else if (!filters?.length) {
      drillByDisabled = DISABLED_REASONS.NO_FILTERS;
    }
  } else {
    drillByDisabled = DISABLED_REASONS.NOT_SUPPORTED;
  }

  const drillToDetailMenuItem = drillDisabled ? (
    <DisabledMenuItem {...props} key="drill-to-detail-disabled">
      {DRILL_TO_DETAIL}
      <MenuItemTooltip title={drillDisabled} />
    </DisabledMenuItem>
  ) : (
    <Menu.Item
      {...props}
      key="drill-to-detail"
      onClick={openModal.bind(null, [])}
      ref={drillToDetailMenuRef}
    >
      {DRILL_TO_DETAIL}
    </Menu.Item>
  );

  const drillToDetailByMenuItem = drillByDisabled ? (
    <DisabledMenuItem {...props} key="drill-to-detail-by-disabled">
      {DRILL_TO_DETAIL_BY}
      <MenuItemTooltip title={drillByDisabled} />
    </DisabledMenuItem>
  ) : (
    <Menu.SubMenu
      {...props}
      popupOffset={[0, submenuYOffset]}
      popupClassName="chart-context-submenu"
      title={DRILL_TO_DETAIL_BY}
    >
      <div data-test="drill-to-detail-by-submenu">
        {filters.map((filter, i) => (
          <MenuItemWithTruncation
            {...props}
            tooltipText={`${DRILL_TO_DETAIL_BY} ${filter.formattedVal}`}
            key={`drill-detail-filter-${i}`}
            onClick={openModal.bind(null, [filter])}
          >
            {`${DRILL_TO_DETAIL_BY} `}
            <StyledFilter stripHTML>{filter.formattedVal}</StyledFilter>
          </MenuItemWithTruncation>
        ))}
        {filters.length > 1 && (
          <Menu.Item
            {...props}
            key="drill-detail-filter-all"
            onClick={openModal.bind(null, filters)}
          >
            <div>
              {`${DRILL_TO_DETAIL_BY} `}
              <StyledFilter stripHTML={false}>{t('all')}</StyledFilter>
            </div>
          </Menu.Item>
        )}
      </div>
    </Menu.SubMenu>
  );

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
