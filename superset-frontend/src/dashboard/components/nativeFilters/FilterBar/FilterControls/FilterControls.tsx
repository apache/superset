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
import React, { FC, useMemo, useState } from 'react';
import { DataMask, styled, t } from '@superset-ui/core';
import { css } from '@emotion/react';
import { useSelector } from 'react-redux';
import * as portals from 'react-reverse-portal';
import { DataMaskStateWithId } from 'src/dataMask/types';
import { Collapse } from 'src/common/components';
import { TAB_TYPE } from 'src/dashboard/util/componentTypes';
import { RootState } from 'src/dashboard/types';
import CascadePopover from '../CascadeFilters/CascadePopover';
import { buildCascadeFiltersTree } from './utils';
import { useFilters } from '../state';
import { Filter } from '../../types';
import { CascadeFilter } from '../CascadeFilters/types';
import { useDashboardLayout } from '../../state';

const Wrapper = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  &:hover {
    cursor: pointer;
  }
`;

type FilterControlsProps = {
  directPathToChild?: string[];
  dataMaskSelected: DataMaskStateWithId;
  onFilterSelectionChange: (filter: Filter, dataMask: DataMask) => void;
};

const FilterControls: FC<FilterControlsProps> = ({
  directPathToChild,
  dataMaskSelected,
  onFilterSelectionChange,
}) => {
  const [visiblePopoverId, setVisiblePopoverId] = useState<string | null>(null);
  const filters = useFilters();
  const dashboardLayout = useDashboardLayout();
  const lastFocusedTabId = useSelector<RootState, string | null>(
    state => state.dashboardState?.lastFocusedTabId,
  );
  const filterValues = Object.values<Filter>(filters);
  const portalNodes = React.useMemo(() => {
    const nodes = new Array(filterValues.length);
    for (let i = 0; i < filterValues.length; i += 1) {
      nodes[i] = portals.createHtmlPortalNode();
    }
    return nodes;
  }, [filterValues.length]);

  const cascadeFilters = useMemo(() => {
    const filtersWithValue = filterValues.map(filter => ({
      ...filter,
      dataMask: dataMaskSelected[filter.id],
    }));
    return buildCascadeFiltersTree(filtersWithValue);
  }, [filterValues, dataMaskSelected]);
  const cascadeFilterIds = new Set(cascadeFilters.map(item => item.id));

  let filtersInScope: CascadeFilter[] = [];
  const filtersOutOfScope: CascadeFilter[] = [];
  const dashboardHasTabs = Object.values(dashboardLayout).some(
    element => element.type === TAB_TYPE,
  );
  const showCollapsePanel = dashboardHasTabs && cascadeFilters.length > 0;
  if (!lastFocusedTabId || !dashboardHasTabs) {
    filtersInScope = cascadeFilters;
  } else {
    cascadeFilters.forEach((filter, index) => {
      if (cascadeFilters[index].tabsInScope?.includes(lastFocusedTabId)) {
        filtersInScope.push(filter);
      } else {
        filtersOutOfScope.push(filter);
      }
    });
  }

  return (
    <Wrapper>
      {portalNodes
        .filter((node, index) => cascadeFilterIds.has(filterValues[index].id))
        .map((node, index) => (
          <portals.InPortal node={node}>
            <CascadePopover
              data-test="cascade-filters-control"
              key={cascadeFilters[index].id}
              dataMaskSelected={dataMaskSelected}
              visible={visiblePopoverId === cascadeFilters[index].id}
              onVisibleChange={visible =>
                setVisiblePopoverId(visible ? cascadeFilters[index].id : null)
              }
              filter={cascadeFilters[index]}
              onFilterSelectionChange={onFilterSelectionChange}
              directPathToChild={directPathToChild}
            />
          </portals.InPortal>
        ))}
      {filtersInScope.map(filter => {
        const index = filterValues.findIndex(f => f.id === filter.id);
        return <portals.OutPortal node={portalNodes[index]} />;
      })}
      {showCollapsePanel && (
        <Collapse
          ghost
          bordered
          expandIconPosition="right"
          collapsible={filtersOutOfScope.length === 0 ? 'disabled' : undefined}
          css={theme => css`
            &.ant-collapse {
              margin-top: ${filtersInScope.length > 0
                ? theme.gridUnit * 6
                : 0}px;
              & > .ant-collapse-item {
                & > .ant-collapse-header {
                  padding-left: 0;
                  padding-bottom: ${theme.gridUnit * 2}px;

                  & > .ant-collapse-arrow {
                    right: ${theme.gridUnit}px;
                  }
                }

                & .ant-collapse-content-box {
                  padding: ${theme.gridUnit * 4}px 0 0;
                }
              }
            }
          `}
        >
          <Collapse.Panel
            header={`${t('Filters out of scope')} (${
              filtersOutOfScope.length
            })`}
            key="1"
          >
            {filtersOutOfScope.map(filter => {
              const index = cascadeFilters.findIndex(f => f.id === filter.id);
              return <portals.OutPortal node={portalNodes[index]} />;
            })}
          </Collapse.Panel>
        </Collapse>
      )}
    </Wrapper>
  );
};

export default FilterControls;
