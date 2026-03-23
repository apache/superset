/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { RefObject, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { MenuProps } from 'antd';
import { t } from '@apache-superset/core/translation';
import { css, useTheme } from '@apache-superset/core/theme';
import { Menu } from '@superset-ui/core/components/Menu';
import { NoAnimationDropdown } from '@superset-ui/core/components';
import { Indicator } from 'src/dashboard/components/nativeFilters/selectors';
import FilterIndicator from 'src/dashboard/components/FiltersBadge/FilterIndicator';
import { RootState } from 'src/dashboard/types';

export interface DetailsPanelProps {
  appliedCrossFilterIndicators: Indicator[];
  appliedIndicators: Indicator[];
  onHighlightFilterSource: (path: string[]) => void;
  children: JSX.Element;
  popoverVisible: boolean;
  popoverContentRef: RefObject<HTMLDivElement>;
  popoverTriggerRef: RefObject<HTMLDivElement>;
  setPopoverVisible: (visible: boolean) => void;
}

const DetailsPanelPopover = ({
  appliedCrossFilterIndicators = [],
  appliedIndicators = [],
  onHighlightFilterSource,
  children,
  popoverVisible,
  setPopoverVisible,
}: DetailsPanelProps) => {
  const theme = useTheme();
  const activeTabs = useSelector<RootState>(
    state => state.dashboardState?.activeTabs,
  );

  useEffect(() => {
    setPopoverVisible(false);
  }, [activeTabs, setPopoverVisible]);

  const indicatorKey = (indicator: Indicator): string =>
    `${indicator.column} - ${indicator.name} - ${indicator.path?.join('>') ?? ''}`;

  const menuItems: MenuProps['items'] = [];

  if (appliedCrossFilterIndicators.length > 0) {
    menuItems.push({
      key: 'grp-cross',
      type: 'group',
      label: t(
        'Applied cross-filters (%d)',
        appliedCrossFilterIndicators.length,
      ),
      children: appliedCrossFilterIndicators.map(indicator => ({
        key: `cross-${indicatorKey(indicator)}`,
        label: (
          <FilterIndicator
            indicator={indicator}
            onClick={onHighlightFilterSource}
          />
        ),
      })),
    });
  }

  if (appliedIndicators.length > 0) {
    if (appliedCrossFilterIndicators.length > 0) {
      menuItems.push({ type: 'divider' });
    }
    menuItems.push({
      key: 'grp-applied',
      type: 'group',
      label: t('Applied filters (%d)', appliedIndicators.length),
      children: appliedIndicators.map(indicator => ({
        key: `applied-${indicatorKey(indicator)}`,
        label: (
          <FilterIndicator
            indicator={indicator}
            onClick={onHighlightFilterSource}
          />
        ),
      })),
    });
  }

  return (
    <NoAnimationDropdown
      popupRender={() => (
        <Menu
          selectable={false}
          items={menuItems}
          onClick={() => setPopoverVisible(false)}
        />
      )}
      overlayStyle={{ zIndex: 1001, animationDuration: '0s' }}
      trigger={['click', 'hover']}
      open={popoverVisible}
      onOpenChange={visible => setPopoverVisible(visible)}
      placement="bottomRight"
    >
      <span
        role="button"
        aria-label={t('View applied filters')}
        aria-haspopup="menu"
        aria-expanded={popoverVisible}
        css={css`
          display: inline-flex;
          outline: none;
          cursor: pointer;
          border-radius: 4px;

          &:focus-visible {
            outline: 2px solid ${theme.colorPrimary};
            outline-offset: 1px;
          }
        `}
      >
        {children}
      </span>
    </NoAnimationDropdown>
  );
};

export default DetailsPanelPopover;
