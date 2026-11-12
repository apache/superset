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
import { useMemo } from 'react';
import { bindActionCreators } from 'redux';
import { useDispatch, useSelector } from 'react-redux';

import { updateDashboardFiltersScope } from '../actions/dashboardFilters';
import FilterScopeSelector from '../components/filterscope/FilterScopeSelector';
import { RootState } from 'src/dashboard/types';
import {
  useDashboardLayoutStore,
  useDashboardStateStore,
} from 'src/dashboard/stores';

interface FilterScopeContainerProps {
  onCloseModal: () => void;
}

export default function FilterScopeContainer({
  onCloseModal,
}: FilterScopeContainerProps) {
  const dispatch = useDispatch();
  const layout = useDashboardLayoutStore(s => s.layout);
  const dashboardFilters = useSelector(
    (state: RootState) => state.dashboardFilters,
  );
  const actions = useMemo(
    () =>
      bindActionCreators(
        {
          updateDashboardFiltersScope,
        },
        dispatch,
      ),
    [dispatch],
  );
  const { setHasUnsavedChanges } = useDashboardStateStore.getState();

  return (
    <FilterScopeSelector
      dashboardFilters={dashboardFilters}
      layout={layout}
      onCloseModal={onCloseModal}
      setUnsavedChanges={setHasUnsavedChanges}
      {...actions}
    />
  );
}
