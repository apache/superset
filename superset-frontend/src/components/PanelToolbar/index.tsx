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
import { Button, Divider, Dropdown } from '@superset-ui/core/components';
import { Menu, MenuItemType } from '@superset-ui/core/components/Menu';
import { Icons } from '@superset-ui/core/components/Icons';
import { commands } from 'src/core';
import ExtensionsManager from 'src/extensions/ExtensionsManager';

export interface PanelToolbarProps {
  viewId: string;
  defaultPrimaryActions?: React.ReactNode;
  defaultSecondaryActions?: MenuItemType[];
}

const PanelToolbar = ({
  viewId,
  defaultPrimaryActions,
  defaultSecondaryActions,
}: PanelToolbarProps) => {
  const theme = useTheme();
  const contributions =
    ExtensionsManager.getInstance().getMenuContributions(viewId);

  const primaryContributions = contributions?.primary || [];
  const secondaryContributions = contributions?.secondary || [];

  const extensionPrimaryActions = useMemo(
    () =>
      primaryContributions
        .map(contribution => {
          const command =
            ExtensionsManager.getInstance().getCommandContribution(
              contribution.command,
            )!;
          if (!command?.icon) {
            return null;
          }
          const Icon =
            (Icons as Record<string, typeof Icons.FileOutlined>)[
              command.icon
            ] ?? Icons.FileOutlined;

          return (
            <Button
              key={contribution.view}
              onClick={() => commands.executeCommand(command?.command)}
              tooltip={command?.description ?? command?.title}
              icon={<Icon iconSize="m" />}
              buttonSize="small"
              aria-label={command?.title}
              variant="text"
              color="primary"
            />
          );
        })
        .filter(Boolean),
    [primaryContributions],
  );

  const secondaryActions = useMemo(
    () =>
      secondaryContributions
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
        .filter(Boolean)
        .concat(defaultSecondaryActions || []),
    [secondaryContributions, defaultSecondaryActions],
  );

  const hasPrimaryActions =
    !!defaultPrimaryActions || extensionPrimaryActions.length > 0;
  const hasSecondaryActions = secondaryActions.length > 0;

  // If no actions at all, render nothing
  if (!hasPrimaryActions && !hasSecondaryActions) {
    return null;
  }

  const toolbarStyles = css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;

    & .ant-divider {
      height: ${theme.sizeUnit * 6}px;
      margin: 0;
    }

    & .superset-button {
      margin-left: 0 !important;
      min-width: ${theme.sizeUnit * 8}px;
    }
  `;

  return (
    <div css={toolbarStyles}>
      {hasPrimaryActions && (
        <>
          {defaultPrimaryActions}
          {extensionPrimaryActions}
        </>
      )}
      {hasPrimaryActions && hasSecondaryActions && <Divider type="vertical" />}
      {hasSecondaryActions && (
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
            color="primary"
            variant="text"
            css={css`
              padding: 8px;
            `}
          >
            <Icons.MoreOutlined />
          </Button>
        </Dropdown>
      )}
    </div>
  );
};

export default PanelToolbar;
