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
import { styled, t, useTheme, css } from '@superset-ui/core';
import { MenuProps } from '@superset-ui/core/components/Menu';
import { FilterBarOrientation, RootState } from 'src/dashboard/types';
import {
  saveFilterBarOrientation,
  saveCrossFiltersSetting,
} from 'src/dashboard/actions/dashboardInfo';
import { Icons } from '@superset-ui/core/components/Icons';
import { Button, Checkbox, Dropdown } from '@superset-ui/core/components';
import { Space } from '@superset-ui/core/components/Space';
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
    padding-left: ${({ theme }) => `${theme.sizeUnit * 2}px`};
  }
`;

const CROSS_FILTERS_MENU_KEY = 'cross-filters-menu-key';
const CROSS_FILTERS_SCOPING_MENU_KEY = 'cross-filters-scoping-menu-key';
const ADD_EDIT_FILTERS_MENU_KEY = 'add-edit-filters-menu-key';

const isOrientation = (o: SelectedKey): o is FilterBarOrientation =>
  o === FilterBarOrientation.Vertical || o === FilterBarOrientation.Horizontal;

const FilterBarSettings = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
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
        <Checkbox
          name="enable-cross-filters"
          checked={crossFiltersEnabled}
          onChange={e => setCrossFiltersEnabled(e.target.checked)}
        >
          {t('Enable cross-filtering')}
        </Checkbox>
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
        className: 'filter-bar-orientation-submenu',
        children: [
          {
            key: FilterBarOrientation.Vertical,
            label: (
              <Space>
                {t('Vertical (Left)')}
                {selectedFilterBarOrientation ===
                  FilterBarOrientation.Vertical && (
                  <Icons.CheckOutlined
                    iconColor={theme.colorPrimary}
                    iconSize="m"
                  />
                )}
              </Space>
            ),
          },
          {
            key: FilterBarOrientation.Horizontal,
            label: (
              <Space>
                {t('Horizontal (Top)')}
                {selectedFilterBarOrientation ===
                  FilterBarOrientation.Horizontal && (
                  <Icons.CheckOutlined
                    iconSize="m"
                    css={css`
                      vertical-align: middle;
                    `}
                  />
                )}
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
        popupRender={menu => (
          <div
            css={css`
              .filter-bar-orientation-submenu.ant-dropdown-menu-submenu-selected
                > .ant-dropdown-menu-submenu-title {
                color: inherit;
              }
            `}
          >
            {menu}
          </div>
        )}
      >
        <Button
          buttonStyle="link"
          css={css`
            padding: 0;
          `}
        >
          <Icons.SettingOutlined
            iconSize="xl"
            name="gear"
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
