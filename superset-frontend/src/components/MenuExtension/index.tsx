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
import { css, useTheme } from '@apache-superset/core/ui';
import { Button, Dropdown } from '@superset-ui/core/components';
import { Menu, MenuItemType } from '@superset-ui/core/components/Menu';
import { Icons } from '@superset-ui/core/components/Icons';
import { commands } from 'src/core';
import ExtensionsManager from 'src/extensions/ExtensionsManager';

export type MenuExtensionProps = {
  viewId: string;
} & (
  | {
      primary: boolean;
      secondary?: never;
      children?: React.ReactNode;
      defaultItems?: never;
      compactMode?: boolean;
    }
  | {
      primary?: never;
      secondary: boolean;
      children?: never;
      defaultItems?: MenuItemType[];
      compactMode?: never;
    }
);

const MenuExtension = ({
  viewId,
  primary,
  secondary,
  defaultItems,
  children,
  compactMode,
}: MenuExtensionProps) => {
  const theme = useTheme();
  const iconColor = theme.colorPrimary;
  const contributions =
    ExtensionsManager.getInstance().getMenuContributions(viewId);

  const actions = primary ? contributions?.primary : contributions?.secondary;
  const primaryActions = useMemo(
    () =>
      primary
        ? (actions || []).map(contribution => {
            const command =
              ExtensionsManager.getInstance().getCommandContribution(
                contribution.command,
              )!;
            // @ts-ignore
            const Icon = Icons[command?.icon as IconNameType];

            return (
              <Button
                key={contribution.view}
                onClick={() => commands.executeCommand(command?.command)}
                tooltip={command?.description}
                icon={<Icon iconSize="m" iconColor={iconColor} />}
                buttonSize="small"
              >
                {!compactMode ? command?.title : undefined}
              </Button>
            );
          })
        : [],
    [actions, primary, iconColor, compactMode],
  );
  const secondaryActions = useMemo(
    () =>
      secondary
        ? (actions || [])
            .map(contribution => {
              const command =
                ExtensionsManager.getInstance().getCommandContribution(
                  contribution.command,
                )!;
              if (!command) {
                return null;
              }
              return {
                key: command.command,
                label: command.title,
                title: command.description,
                onClick: () => commands.executeCommand(command.command),
              } as MenuItemType;
            })
            .concat(...(defaultItems || []))
            .filter(Boolean)
        : [],
    [actions, secondary, defaultItems],
  );

  if (secondary && secondaryActions.length === 0) {
    return null;
  }

  if (secondary) {
    return (
      <Dropdown
        popupRender={() => (
          <Menu
            css={css`
              & .ant-dropdown-menu-title-content > div {
                gap: ${theme.sizeUnit * 4}px;
              }
            `}
            items={secondaryActions}
          />
        )}
        trigger={['click']}
      >
        <Button
          showMarginRight={false}
          buttonStyle="secondary"
          css={css`
            padding: 8px;
          `}
        >
          <Icons.MoreOutlined />
        </Button>
      </Dropdown>
    );
  }
  return (
    <>
      {primaryActions}
      {children}
    </>
  );
};

export default MenuExtension;
