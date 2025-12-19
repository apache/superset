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

import { useState, useCallback, Key } from 'react';
import { t } from '@superset-ui/core';
import { css, useTheme } from '@apache-superset/core/ui';
import { Menu } from '@superset-ui/core/components/Menu';
import {
  NoAnimationDropdown,
  Button,
  Tooltip,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { Link } from 'react-router-dom';
import { WhatIfSimulation } from './whatIfApi';

enum MenuKeys {
  LoadSimulation = 'load-simulation',
  SaveSimulation = 'save-simulation',
  SaveAsNew = 'save-as-new',
  ManageSimulations = 'manage-simulations',
}

interface WhatIfHeaderMenuProps {
  selectedSimulation: WhatIfSimulation | null;
  onSelectSimulation: (simulation: WhatIfSimulation | null) => void;
  onSaveClick: () => void;
  onSaveAsNewClick: () => void;
  hasModifications: boolean;
  simulations: WhatIfSimulation[];
  simulationsLoading: boolean;
}

const VerticalDotsTrigger = () => {
  const theme = useTheme();
  return (
    <Icons.EllipsisOutlined
      css={css`
        transform: rotate(90deg);
        &:hover {
          cursor: pointer;
        }
      `}
      iconSize="xl"
      iconColor={theme.colorTextLabel}
    />
  );
};

const WhatIfHeaderMenu = ({
  selectedSimulation,
  onSelectSimulation,
  onSaveClick,
  onSaveAsNewClick,
  hasModifications,
  simulations,
  simulationsLoading,
}: WhatIfHeaderMenuProps) => {
  const theme = useTheme();
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);

  const handleMenuClick = useCallback(
    ({ key }: { key: Key }) => {
      const keyStr = String(key);

      if (keyStr === MenuKeys.SaveSimulation) {
        onSaveClick();
        setIsDropdownVisible(false);
      } else if (keyStr === MenuKeys.SaveAsNew) {
        onSaveAsNewClick();
        setIsDropdownVisible(false);
      } else if (keyStr.startsWith('load-sim-')) {
        const simId = parseInt(keyStr.replace('load-sim-', ''), 10);
        const sim = simulations.find(s => s.id === simId);
        if (sim) {
          onSelectSimulation(sim);
        }
        setIsDropdownVisible(false);
      } else if (keyStr === 'clear-simulation') {
        onSelectSimulation(null);
        setIsDropdownVisible(false);
      }
    },
    [simulations, onSelectSimulation, onSaveClick, onSaveAsNewClick],
  );

  const simulationMenuItems =
    simulations.length > 0
      ? [
          ...(selectedSimulation
            ? [
                {
                  key: 'clear-simulation',
                  label: t('Clear current simulation'),
                  icon: <Icons.CloseOutlined />,
                },
                { type: 'divider' as const },
              ]
            : []),
          ...simulations.map(sim => ({
            key: `load-sim-${sim.id}`,
            label: (
              <div
                css={css`
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  gap: ${theme.sizeUnit * 2}px;
                `}
              >
                <span
                  css={css`
                    flex: 1;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                  `}
                >
                  {sim.name}
                  {selectedSimulation?.id === sim.id && (
                    <Icons.CheckOutlined
                      css={css`
                        margin-left: ${theme.sizeUnit}px;
                        color: ${theme.colorSuccess};
                      `}
                    />
                  )}
                </span>
                {sim.description && (
                  <Tooltip title={sim.description}>
                    <Icons.InfoCircleOutlined
                      onClick={e => e.stopPropagation()}
                      css={css`
                        color: ${theme.colorTextSecondary};
                        font-size: ${theme.fontSizeSM}px;
                      `}
                    />
                  </Tooltip>
                )}
              </div>
            ),
          })),
        ]
      : [
          {
            key: 'no-simulations',
            label: t('No saved simulations'),
            disabled: true,
          },
        ];

  const menuItems = [
    {
      type: 'submenu' as const,
      key: MenuKeys.LoadSimulation,
      label: simulationsLoading ? t('Loading...') : t('Load simulation'),
      icon: <Icons.FolderOpenOutlined />,
      children: simulationMenuItems,
    },
    {
      key: MenuKeys.SaveSimulation,
      label: selectedSimulation ? t('Update simulation') : t('Save simulation'),
      icon: <Icons.SaveOutlined />,
      disabled: !hasModifications,
    },
    ...(selectedSimulation
      ? [
          {
            key: MenuKeys.SaveAsNew,
            label: t('Save as new'),
            icon: <Icons.PlusOutlined />,
            disabled: !hasModifications,
          },
        ]
      : []),
    { type: 'divider' as const },
    {
      key: MenuKeys.ManageSimulations,
      label: <Link to="/whatif/simulations/">{t('Manage simulations')}</Link>,
      icon: <Icons.SettingOutlined />,
    },
  ];

  return (
    <NoAnimationDropdown
      popupRender={() => (
        <Menu
          onClick={handleMenuClick}
          data-test="what-if-header-menu"
          selectable={false}
          items={menuItems}
        />
      )}
      trigger={['click']}
      placement="bottomRight"
      open={isDropdownVisible}
      onOpenChange={visible => setIsDropdownVisible(visible)}
    >
      <Button
        buttonStyle="link"
        aria-label={t('More Options')}
        aria-haspopup="true"
        css={css`
          padding: ${theme.sizeUnit}px;
          display: flex;
          align-items: center;
          justify-content: center;
        `}
      >
        <VerticalDotsTrigger />
      </Button>
    </NoAnimationDropdown>
  );
};

export default WhatIfHeaderMenu;
