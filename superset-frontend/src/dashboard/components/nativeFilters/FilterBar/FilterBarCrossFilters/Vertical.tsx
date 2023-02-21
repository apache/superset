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

import React, { useMemo } from 'react';
import Collapse from 'src/components/Collapse';
import { styled, t, DataMaskStateWithId } from '@superset-ui/core';
import { useSelector } from 'react-redux';
import {
  DashboardInfo,
  DashboardLayout,
  FilterBarOrientation,
  RootState,
} from 'src/dashboard/types';
import CrossFilter from './CrossFilter';
import crossFiltersSelector from './selectors';

const StyledCollapse = styled(Collapse)`
  ${({ theme }) => `
    .ant-collapse-item > .ant-collapse-header {
      padding-bottom: 0;
    }
    .ant-collapse-item > .ant-collapse-header > .ant-collapse-arrow {
      font-size: ${theme.typography.sizes.xs}px;
      padding-top: ${theme.gridUnit * 3.5}px;
    }
    .ant-collapse-item > .ant-collapse-content > .ant-collapse-content-box {
      padding-top: 0;
    }
  `}
`;

const StyledCrossFiltersTitle = styled.span`
  font-size: ${({ theme }) => `${theme.typography.sizes.s}px;`};
`;

const FilterBarCrossFiltersVertical = () => {
  const dataMask = useSelector<RootState, DataMaskStateWithId>(
    state => state.dataMask,
  );
  const dashboardInfo = useSelector<RootState, DashboardInfo>(
    state => state.dashboardInfo,
  );
  const dashboardLayout = useSelector<RootState, DashboardLayout>(
    state => state.dashboardLayout.present,
  );
  const selectedCrossFilters = crossFiltersSelector({
    dataMask,
    dashboardInfo,
    dashboardLayout,
  });

  const crossFiltersIndicators = useMemo(
    () =>
      selectedCrossFilters.map(filter => (
        <CrossFilter
          key={filter.emitterId}
          filter={filter}
          orientation={FilterBarOrientation.VERTICAL}
        />
      )),
    [selectedCrossFilters],
  );

  if (!selectedCrossFilters.length) {
    return null;
  }

  return (
    <StyledCollapse
      ghost
      defaultActiveKey="crossFilters"
      expandIconPosition="right"
    >
      <Collapse.Panel
        key="crossFilters"
        header={
          <StyledCrossFiltersTitle>
            {t('Cross-filters')}
          </StyledCrossFiltersTitle>
        }
      >
        {crossFiltersIndicators}
      </Collapse.Panel>
    </StyledCollapse>
  );
};

export default FilterBarCrossFiltersVertical;
