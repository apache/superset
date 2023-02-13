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

import React, { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  FeatureFlag,
  isFeatureEnabled,
  styled,
  t,
  useTheme,
} from '@superset-ui/core';
import { MenuProps } from 'src/components/Menu';
import { FilterBarOrientation, RootState } from 'src/dashboard/types';
import {
  saveFilterBarOrientation,
  saveCrossFiltersSetting,
} from 'src/dashboard/actions/dashboardInfo';
import Icons from 'src/components/Icons';
import DropdownSelectableIcon, {
  DropDownSelectableProps,
} from 'src/components/DropdownSelectableIcon';
import Checkbox from 'src/components/Checkbox';
import { clearDataMaskState } from 'src/dataMask/actions';

type SelectedKey = FilterBarOrientation | string | number;

const StyledMenuLabel = styled.span`
  display: flex;
  align-items: center;
  justify-content: space-between;

  .enable-cross-filters-text {
    padding-left: ${({ theme }) => `${theme.gridUnit * 2}px`};
  }
`;

const StyledCheckbox = styled(Checkbox)`
  ${({ theme }) => `
  &,
  svg {
    display: inline-block;
    width: ${theme.gridUnit * 4}px;
    height: ${theme.gridUnit * 4}px;
  }
`}
`;

const FilterBarSettings = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isCrossFiltersEnabled = useSelector<RootState, boolean>(
    ({ dashboardInfo }) => dashboardInfo.crossFiltersEnabled,
  );
  const filterBarOrientation = useSelector<RootState, FilterBarOrientation>(
    ({ dashboardInfo }) => dashboardInfo.filterBarOrientation,
  );
  const [selectedFilterBarOrientation, setSelectedFilterBarOrientation] =
    useState(filterBarOrientation);
  const isCrossFiltersFeatureEnabled = isFeatureEnabled(
    FeatureFlag.DASHBOARD_CROSS_FILTERS,
  );
  const shouldEnableCrossFilters =
    !!isCrossFiltersEnabled && isCrossFiltersFeatureEnabled;
  const [crossFiltersEnabled, setCrossFiltersEnabled] = useState<boolean>(
    shouldEnableCrossFilters,
  );
  const canEdit = useSelector<RootState, boolean>(
    ({ dashboardInfo }) => dashboardInfo.dash_edit_perm,
  );
  const canSetHorizontalFilterBar =
    canEdit && isFeatureEnabled(FeatureFlag.HORIZONTAL_FILTER_BAR);
  const crossFiltersMenuKey = 'cross-filters-menu-key';
  const isOrientation = (o: SelectedKey): o is FilterBarOrientation =>
    o === FilterBarOrientation.VERTICAL ||
    o === FilterBarOrientation.HORIZONTAL;
  const updateCrossFiltersSetting = useCallback(
    async isEnabled => {
      if (!isEnabled) {
        dispatch(clearDataMaskState());
      }
      await dispatch(saveCrossFiltersSetting(isEnabled));
    },
    [dispatch, crossFiltersEnabled],
  );
  const changeFilterBarSettings = useCallback(
    async (
      selection: Parameters<
        Required<Pick<MenuProps, 'onSelect'>>['onSelect']
      >[0],
    ) => {
      const selectedKey: SelectedKey = selection.key;
      if (selectedKey === crossFiltersMenuKey) {
        setCrossFiltersEnabled(!crossFiltersEnabled);
        updateCrossFiltersSetting(!crossFiltersEnabled);
        return;
      }
      if (isOrientation(selectedKey) && selectedKey !== filterBarOrientation) {
        // set displayed selection in local state for immediate visual response after clicking
        setSelectedFilterBarOrientation(selectedKey as FilterBarOrientation);
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
    [dispatch, crossFiltersEnabled, filterBarOrientation],
  );
  const crossFiltersMenuItem = useMemo(
    () => (
      <StyledMenuLabel>
        <StyledCheckbox
          className="enable-cross-filters"
          checked={crossFiltersEnabled}
          onChange={checked => setCrossFiltersEnabled(checked || false)}
        />{' '}
        <span className="enable-cross-filters-text">
          {t('Enable cross-filtering')}
        </span>
      </StyledMenuLabel>
    ),
    [crossFiltersEnabled],
  );
  const menuItems: DropDownSelectableProps['menuItems'] = [];

  if (isCrossFiltersFeatureEnabled) {
    menuItems.unshift({
      key: crossFiltersMenuKey,
      label: crossFiltersMenuItem,
      divider: canSetHorizontalFilterBar,
    });
  }

  if (canSetHorizontalFilterBar) {
    menuItems.push({
      key: 'placement',
      label: t('Orientation of filter bar'),
      children: [
        {
          key: FilterBarOrientation.VERTICAL,
          label: t('Vertical (Left)'),
        },
        {
          key: FilterBarOrientation.HORIZONTAL,
          label: t('Horizontal (Top)'),
        },
      ],
    });
  }

  if (!menuItems.length) {
    return null;
  }

  return (
    <DropdownSelectableIcon
      onSelect={changeFilterBarSettings}
      icon={
        <Icons.Gear
          name="gear"
          iconColor={theme.colors.grayscale.base}
          data-test="filterbar-orientation-icon"
        />
      }
      menuItems={menuItems}
      selectedKeys={[selectedFilterBarOrientation]}
    />
  );
};

export default FilterBarSettings;
