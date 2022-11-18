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

import React, { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t, useTheme } from '@superset-ui/core';
import { MenuProps } from 'src/components/Menu';
import { FilterBarOrientation, RootState } from 'src/dashboard/types';
import { saveFilterBarOrientation } from 'src/dashboard/actions/dashboardInfo';
import Icons from 'src/components/Icons';
import DropdownSelectableIcon from 'src/components/DropdownSelectableIcon';

const FilterBarOrientationSelect = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const filterBarOrientation = useSelector<RootState, FilterBarOrientation>(
    ({ dashboardInfo }) => dashboardInfo.filterBarOrientation,
  );
  const [selectedFilterBarOrientation, setSelectedFilterBarOrientation] =
    useState(filterBarOrientation);

  const toggleFilterBarOrientation = useCallback(
    async (
      selection: Parameters<
        Required<Pick<MenuProps, 'onSelect'>>['onSelect']
      >[0],
    ) => {
      const selectedKey = selection.key as FilterBarOrientation;
      if (selectedKey !== filterBarOrientation) {
        // set displayed selection in local state for immediate visual response after clicking
        setSelectedFilterBarOrientation(selectedKey);
        try {
          // save selection in Redux and backend
          await dispatch(
            saveFilterBarOrientation(selection.key as FilterBarOrientation),
          );
        } catch {
          // revert local state in case of error when saving
          setSelectedFilterBarOrientation(filterBarOrientation);
        }
      }
    },
    [dispatch, filterBarOrientation],
  );

  return (
    <DropdownSelectableIcon
      onSelect={toggleFilterBarOrientation}
      info={t('Orientation of filter bar')}
      icon={<Icons.Gear name="gear" iconColor={theme.colors.grayscale.base} />}
      menuItems={[
        {
          key: FilterBarOrientation.VERTICAL,
          label: t('Vertical (Left)'),
        },
        {
          key: FilterBarOrientation.HORIZONTAL,
          label: t('Horizontal (Top)'),
        },
      ]}
      selectedKeys={[selectedFilterBarOrientation]}
    />
  );
};

export default FilterBarOrientationSelect;
