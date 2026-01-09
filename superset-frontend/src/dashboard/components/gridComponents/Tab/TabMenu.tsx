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
import { useState, useCallback } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { getClientErrorObject, t } from '@superset-ui/core';
import { css, useTheme } from '@apache-superset/core/ui';
import { Dropdown, Icons, type MenuProps } from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import copyTextToClipboard from 'src/utils/copy';
import { getDashboardPermalink } from 'src/utils/urlUtils';
import { RootState } from 'src/dashboard/types';
import { hasStatefulCharts } from 'src/dashboard/util/chartStateConverter';

export interface TabMenuProps {
  tabId: string;
  dashboardId: number;
  canEditDashboard: boolean;
  onEditTitle?: () => void;
}

export default function TabMenu({
  tabId,
  dashboardId,
  canEditDashboard,
  onEditTitle,
}: TabMenuProps) {
  const theme = useTheme();
  const { addSuccessToast, addDangerToast } = useToasts();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const { dataMask, activeTabs, chartStates, sliceEntities } = useSelector(
    (state: RootState) => ({
      dataMask: state.dataMask,
      activeTabs: state.dashboardState.activeTabs,
      chartStates: state.dashboardState.chartStates,
      sliceEntities: state.sliceEntities?.slices,
    }),
    shallowEqual,
  );

  const handleCopyPermalink = useCallback(async () => {
    try {
      const includeChartState =
        hasStatefulCharts(sliceEntities) &&
        chartStates &&
        Object.keys(chartStates).length > 0;

      const url = await getDashboardPermalink({
        dashboardId,
        dataMask,
        activeTabs,
        anchor: tabId,
        chartStates: includeChartState ? chartStates : undefined,
        includeChartState,
      });

      await copyTextToClipboard(() => Promise.resolve(url));
      addSuccessToast(t('Permalink copied to clipboard!'));
    } catch (error) {
      if (error) {
        addDangerToast(
          (await getClientErrorObject(error)).error ||
            t('Something went wrong.'),
        );
      }
    }
  }, [
    dashboardId,
    tabId,
    dataMask,
    activeTabs,
    chartStates,
    sliceEntities,
    addSuccessToast,
    addDangerToast,
  ]);

  const handleMenuClick: MenuProps['onClick'] = useCallback(
    ({ key, domEvent }) => {
      domEvent.stopPropagation();
      setIsDropdownOpen(false);

      switch (key) {
        case 'copy-permalink':
          handleCopyPermalink();
          break;
        case 'edit-title':
          onEditTitle?.();
          break;
        default:
          break;
      }
    },
    [handleCopyPermalink, onEditTitle],
  );

  const menuItems: MenuProps['items'] = [
    {
      key: 'copy-permalink',
      label: t('Copy permalink'),
      icon: <Icons.Link iconSize="m" />,
    },
    ...(canEditDashboard
      ? [
          {
            key: 'edit-title',
            label: t('Edit tab title'),
            icon: <Icons.EditOutlined iconSize="m" />,
          },
        ]
      : []),
  ];

  return (
    <Dropdown
      menu={{ items: menuItems, onClick: handleMenuClick }}
      trigger={['click']}
      open={isDropdownOpen}
      onOpenChange={setIsDropdownOpen}
    >
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          setIsDropdownOpen(!isDropdownOpen);
        }}
        css={css`
          background: transparent;
          border: none;
          cursor: pointer;
          padding: ${theme.sizeUnit}px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: ${theme.sizeUnit}px;

          &:hover {
            background: ${theme.colorBgElevated};
          }
        `}
        aria-label={t('Tab actions')}
      >
        <Icons.MoreVert iconSize="m" iconColor={theme.colorTextSecondary} />
      </button>
    </Dropdown>
  );
}
