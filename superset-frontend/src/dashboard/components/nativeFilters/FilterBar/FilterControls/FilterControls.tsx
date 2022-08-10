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
import React, { FC, useCallback, useMemo } from 'react';
import { css } from '@emotion/react';
import {
  DataMask,
  DataMaskStateWithId,
  Filter,
  isFilterDivider,
  styled,
  t,
} from '@superset-ui/core';
import {
  createHtmlPortalNode,
  InPortal,
  OutPortal,
} from 'react-reverse-portal';
import { AntdCollapse } from 'src/components';
import {
  useDashboardHasTabs,
  useSelectFiltersInScope,
} from 'src/dashboard/components/nativeFilters/state';
import { useFilters } from '../state';
import FilterControl from './FilterControl';

const Wrapper = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  // 108px padding to make room for buttons with position: absolute
  padding-bottom: ${({ theme }) => theme.gridUnit * 27}px;
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
  const filters = useFilters();
  const filterValues = useMemo(() => Object.values(filters), [filters]);
  const portalNodes = useMemo(() => {
    const nodes = new Array(filterValues.length);
    for (let i = 0; i < filterValues.length; i += 1) {
      nodes[i] = createHtmlPortalNode();
    }
    return nodes;
  }, [filterValues.length]);

  const filtersWithValues = useMemo(
    () =>
      filterValues.map(filter => ({
        ...filter,
        dataMask: dataMaskSelected[filter.id],
      })),
    [filterValues, dataMaskSelected],
  );
  const filterIds = new Set(filtersWithValues.map(item => item.id));

  const [filtersInScope, filtersOutOfScope] =
    useSelectFiltersInScope(filtersWithValues);
  const dashboardHasTabs = useDashboardHasTabs();
  const showCollapsePanel = dashboardHasTabs && filtersWithValues.length > 0;

  const filterControlFactory = useCallback(
    index => {
      const filter = filtersWithValues[index];
      if (isFilterDivider(filter)) {
        return (
          <div>
            <h3>{filter.title}</h3>
            <p>{filter.description}</p>
          </div>
        );
      }
      return (
        <FilterControl
          dataMaskSelected={dataMaskSelected}
          filter={filter}
          directPathToChild={directPathToChild}
          onFilterSelectionChange={onFilterSelectionChange}
          inView={false}
        />
      );
    },
    [
      filtersWithValues,
      JSON.stringify(dataMaskSelected),
      directPathToChild,
      onFilterSelectionChange,
    ],
  );
  return (
    <Wrapper>
      {portalNodes
        .filter((node, index) => filterIds.has(filterValues[index].id))
        .map((node, index) => (
          <InPortal node={node}>{filterControlFactory(index)}</InPortal>
        ))}
      {filtersInScope.map(filter => {
        const index = filterValues.findIndex(f => f.id === filter.id);
        return <OutPortal node={portalNodes[index]} inView />;
      })}
      {showCollapsePanel && (
        <AntdCollapse
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
          <AntdCollapse.Panel
            header={t('Filters out of scope (%d)', filtersOutOfScope.length)}
            key="1"
          >
            {filtersOutOfScope.map(filter => {
              const index = filtersWithValues.findIndex(
                f => f.id === filter.id,
              );
              return <OutPortal node={portalNodes[index]} inView />;
            })}
          </AntdCollapse.Panel>
        </AntdCollapse>
      )}
    </Wrapper>
  );
};

export default React.memo(FilterControls);
