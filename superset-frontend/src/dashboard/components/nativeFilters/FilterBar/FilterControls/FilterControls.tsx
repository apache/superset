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
import React, { FC, useCallback, useMemo, useState } from 'react';
import { css } from '@emotion/react';
import { DataMask, styled, t } from '@superset-ui/core';
import {
  createHtmlPortalNode,
  InPortal,
  OutPortal,
} from 'react-reverse-portal';
import { Collapse } from 'src/common/components';
import { DataMaskStateWithId } from 'src/dataMask/types';
import {
  useDashboardHasTabs,
  useSelectFiltersInScope,
} from 'src/dashboard/components/nativeFilters/state';
import { Filter } from 'src/dashboard/components/nativeFilters/types';
import CascadePopover from '../CascadeFilters/CascadePopover';
import { useFilters } from '../state';
import { buildCascadeFiltersTree } from './utils';

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
  const filterValues = useMemo(() => Object.values<Filter>(filters), [filters]);
  const portalNodes = useMemo(() => {
    const nodes = new Array(filterValues.length);
    for (let i = 0; i < filterValues.length; i += 1) {
      nodes[i] = createHtmlPortalNode();
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

  const [filtersInScope, filtersOutOfScope] = useSelectFiltersInScope(
    cascadeFilters,
  );
  const dashboardHasTabs = useDashboardHasTabs();
  const showCollapsePanel = dashboardHasTabs && cascadeFilters.length > 0;

  const cascadePopoverFactory = useCallback(
    index => (
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
        inView={false}
      />
    ),
    [
      cascadeFilters,
      JSON.stringify(dataMaskSelected),
      directPathToChild,
      onFilterSelectionChange,
      visiblePopoverId,
    ],
  );
  return (
    <Wrapper>
      {portalNodes
        .filter((node, index) => cascadeFilterIds.has(filterValues[index].id))
        .map((node, index) => (
          <InPortal node={node}>{cascadePopoverFactory(index)}</InPortal>
        ))}
      {filtersInScope.map(filter => {
        const index = filterValues.findIndex(f => f.id === filter.id);
        return <OutPortal node={portalNodes[index]} inView />;
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
              return <OutPortal node={portalNodes[index]} inView />;
            })}
          </Collapse.Panel>
        </Collapse>
      )}
    </Wrapper>
  );
};

export default React.memo(FilterControls);
