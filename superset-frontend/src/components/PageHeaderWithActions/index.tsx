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
import React, { ReactNode, ReactElement } from 'react';
import { css, SupersetTheme, t, useTheme } from '@superset-ui/core';
import { AntdDropdown, AntdDropdownProps } from 'src/components';
import {
  DynamicEditableTitle,
  DynamicEditableTitleProps,
} from '../DynamicEditableTitle';
import CertifiedBadge, { CertifiedBadgeProps } from '../CertifiedBadge';
import FaveStar, { FaveStarProps } from '../FaveStar';
import Icons from '../Icons';
import Button from '../Button';

export const menuTriggerStyles = (theme: SupersetTheme) => css`
  width: ${theme.gridUnit * 8}px;
  height: ${theme.gridUnit * 8}px;
  padding: 0;
  border: 1px solid ${theme.colors.primary.dark2};

  &.ant-btn > span.anticon {
    line-height: 0;
    transition: inherit;
  }

  &:hover:not(:focus) > span.anticon {
    color: ${theme.colors.primary.light1};
  }
`;

const headerStyles = (theme: SupersetTheme) => css`
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: nowrap;
  justify-content: space-between;
  background-color: ${theme.colors.grayscale.light5};
  height: ${theme.gridUnit * 16}px;
  padding: 0 ${theme.gridUnit * 4}px;

  .editable-title {
    overflow: hidden;

    & > input[type='button'],
    & > span {
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      white-space: nowrap;
    }
  }

  span[role='button'] {
    display: flex;
    height: 100%;
  }

  .title-panel {
    display: flex;
    align-items: center;
    min-width: 0;
    margin-right: ${theme.gridUnit * 12}px;
  }

  .right-button-panel {
    display: flex;
    align-items: center;
  }
`;

const buttonsStyles = (theme: SupersetTheme) => css`
  display: flex;
  align-items: center;
  padding-left: ${theme.gridUnit * 2}px;

  & .fave-unfave-icon {
    padding: 0 ${theme.gridUnit}px;

    &:first-of-type {
      padding-left: 0;
    }
  }
`;

const additionalActionsContainerStyles = (theme: SupersetTheme) => css`
  margin-left: ${theme.gridUnit * 2}px;
`;

export type PageHeaderWithActionsProps = {
  editableTitleProps: DynamicEditableTitleProps;
  showTitlePanelItems: boolean;
  certificatiedBadgeProps?: CertifiedBadgeProps;
  showFaveStar: boolean;
  faveStarProps: FaveStarProps;
  titlePanelAdditionalItems: ReactNode;
  rightPanelAdditionalItems: ReactNode;
  additionalActionsMenu: ReactElement;
  menuDropdownProps: Omit<AntdDropdownProps, 'overlay'>;
};

export const PageHeaderWithActions = ({
  editableTitleProps,
  showTitlePanelItems,
  certificatiedBadgeProps,
  showFaveStar,
  faveStarProps,
  titlePanelAdditionalItems,
  rightPanelAdditionalItems,
  additionalActionsMenu,
  menuDropdownProps,
}: PageHeaderWithActionsProps) => {
  const theme = useTheme();
  return (
    <div css={headerStyles} className="header-with-actions">
      <div className="title-panel">
        <DynamicEditableTitle {...editableTitleProps} />
        {showTitlePanelItems && (
          <div css={buttonsStyles}>
            {certificatiedBadgeProps?.certifiedBy && (
              <CertifiedBadge {...certificatiedBadgeProps} />
            )}
            {showFaveStar && <FaveStar {...faveStarProps} />}
            {titlePanelAdditionalItems}
          </div>
        )}
      </div>
      <div className="right-button-panel">
        {rightPanelAdditionalItems}
        <div css={additionalActionsContainerStyles}>
          <AntdDropdown
            trigger={['click']}
            overlay={additionalActionsMenu}
            {...menuDropdownProps}
          >
            <Button
              css={menuTriggerStyles}
              buttonStyle="tertiary"
              aria-label={t('Menu actions trigger')}
              data-test="actions-trigger"
            >
              <Icons.MoreHoriz
                iconColor={theme.colors.primary.dark2}
                iconSize="l"
              />
            </Button>
          </AntdDropdown>
        </div>
      </div>
    </div>
  );
};
