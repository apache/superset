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

import { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { styled, t, useTheme } from '@superset-ui/core';
import { MenuProps } from 'src/components/Menu';
import { FilterBarOrientation, RootState } from 'src/dashboard/types';
import {
  saveFilterBarOrientation,
  saveCrossFiltersSetting,
} from 'src/dashboard/actions/dashboardInfo';
import Icons from 'src/components/Icons';
import Checkbox from 'src/components/Checkbox';
import { Dropdown } from 'src/components/Dropdown';
import { Button } from 'src/components';
import { Space } from 'src/components/Space';
import { clearDataMaskState } from 'src/dataMask/actions';
import { useFilters } from 'src/dashboard/components/nativeFilters/FilterBar/state';
import { useFilterConfigModal } from 'src/dashboard/components/nativeFilters/FilterBar/FilterConfigurationLink/useFilterConfigModal';
import { useCrossFiltersScopingModal } from '../CrossFilters/ScopingModal/useCrossFiltersScopingModal';
import FilterConfigurationLink from '../FilterConfigurationLink';

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

const CROSS_FILTERS_MENU_KEY = 'cross-filters-menu-key';
const CROSS_FILTERS_SCOPING_MENU_KEY = 'cross-filters-scoping-menu-key';
const ADD_EDIT_FILTERS_MENU_KEY = 'add-edit-filters-menu-key';

const isOrientation = (o: SelectedKey): o is FilterBarOrientation =>
  o === FilterBarOrientation.Vertical || o === FilterBarOrientation.Horizontal;

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

  const [crossFiltersEnabled, setCrossFiltersEnabled] = useState<boolean>(
    isCrossFiltersEnabled,
  );
  const canEdit = useSelector<RootState, boolean>(
    ({ dashboardInfo }) => dashboardInfo.dash_edit_perm,
  );
  const filters = useFilters();
  const filterValues = useMemo(() => Object.values(filters), [filters]);
  const dashboardId = useSelector<RootState, number>(
    ({ dashboardInfo }) => dashboardInfo.id,
  );

  const [openScopingModal, scopingModal] = useCrossFiltersScopingModal();

  const { openFilterConfigModal, FilterConfigModalComponent } =
    useFilterConfigModal({
      createNewOnOpen: filterValues.length === 0,
      dashboardId,
    });

  const updateCrossFiltersSetting = useCallback(
    async isEnabled => {
      if (!isEnabled) {
        dispatch(clearDataMaskState());
      }
      await dispatch(saveCrossFiltersSetting(isEnabled));
    },
    [dispatch],
  );

  const toggleCrossFiltering = useCallback(() => {
    setCrossFiltersEnabled(!crossFiltersEnabled);
    updateCrossFiltersSetting(!crossFiltersEnabled);
  }, [crossFiltersEnabled, updateCrossFiltersSetting]);

  const toggleFilterBarOrientation = useCallback(
    async (orientation: FilterBarOrientation) => {
      if (orientation === filterBarOrientation) {
        return;
      }
      // set displayed selection in local state for immediate visual response after clicking
      setSelectedFilterBarOrientation(orientation);
      try {
        // save selection in Redux and backend
        await dispatch(saveFilterBarOrientation(orientation));
      } catch {
        // revert local state in case of error when saving
        setSelectedFilterBarOrientation(filterBarOrientation);
      }
    },
    [dispatch, filterBarOrientation],
  );

  const handleClick = useCallback(
    (
      selection: Parameters<
        Required<Pick<MenuProps, 'onSelect'>>['onSelect']
      >[0],
    ) => {
      const selectedKey: SelectedKey = selection.key;
      if (selectedKey === CROSS_FILTERS_MENU_KEY) {
        toggleCrossFiltering();
      } else if (isOrientation(selectedKey)) {
        toggleFilterBarOrientation(selectedKey);
      } else if (selectedKey === CROSS_FILTERS_SCOPING_MENU_KEY) {
        openScopingModal();
      } else if (selectedKey === ADD_EDIT_FILTERS_MENU_KEY) {
        openFilterConfigModal();
      }
    },
    [
      openScopingModal,
      toggleCrossFiltering,
      toggleFilterBarOrientation,
      openFilterConfigModal,
    ],
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

  const menuItems = useMemo(() => {
    const items: MenuProps['items'] = [];

    if (canEdit) {
      items.push({
        key: ADD_EDIT_FILTERS_MENU_KEY,
        label: (
          <FilterConfigurationLink>
            {t('Add or edit filters')}
          </FilterConfigurationLink>
        ),
      });
      if (canEdit) {
        items.push({ type: 'divider' });
      }
    }
    if (canEdit) {
      items.push({
        key: CROSS_FILTERS_MENU_KEY,
        label: crossFiltersMenuItem,
      });
      items.push({
        key: CROSS_FILTERS_SCOPING_MENU_KEY,
        label: t('Cross-filtering scoping'),
      });
      items.push({ type: 'divider' });
    }
    if (canEdit) {
      items.push({
        key: 'placement',
        label: t('Orientation of filter bar'),
        children: [
          {
            key: FilterBarOrientation.Vertical,
            label: (
              <Space>
                {t('Vertical (Left)')}
                {selectedFilterBarOrientation ===
                  FilterBarOrientation.Vertical && <Icons.Check />}
              </Space>
            ),
          },
          {
            key: FilterBarOrientation.Horizontal,
            label: (
              <Space>
                {t('Horizontal (Top)')}
                {selectedFilterBarOrientation ===
                  FilterBarOrientation.Horizontal && <Icons.Check />}
              </Space>
            ),
          },
        ],
        ...{ 'data-test': 'dropdown-selectable-icon-submenu' },
      });
    }
    return items;
  }, [
    selectedFilterBarOrientation,
    canEdit,
    crossFiltersMenuItem,
    dashboardId,
    filterValues,
  ]);

  if (!menuItems.length) {
    return null;
  }

  return (
    <>
      <Dropdown
        menu={{
          onClick: handleClick,
          items: menuItems,
          selectedKeys: [selectedFilterBarOrientation],
        }}
        trigger={['click']}
      >
        <Button type="link">
          <Icons.Gear
            name="gear"
            iconColor={theme.colors.grayscale.base}
            data-test="filterbar-orientation-icon"
          />
        </Button>
      </Dropdown>
      {scopingModal}
      {FilterConfigModalComponent}
    </>
  );
};

export default FilterBarSettings;
