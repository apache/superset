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
import { isValidElement, cloneElement } from 'react';
import { css, useTheme, t } from '@superset-ui/core';
import { Typography, Icons } from '@superset-ui/core/components';
import type { IconType } from '@superset-ui/core/components/Icons/types';

type EditModeTitleConfig = {
  /** Indicates whether the component is in edit mode */
  isEditMode: boolean;
  /** Title shown when not in edit mode */
  titleAdd: string;
  /** Title shown when in edit mode */
  titleEdit: string;
};

type ModalTitleWithIconProps = {
  /**
   * Optional configuration for dynamic titles based on edit mode.
   * If provided, it overrides the static `title` prop.
   */
  editModeConfig?: EditModeTitleConfig;

  /**
   * Static title used when `editModeConfig` is not provided.
   */
  title?: string | React.ReactNode;

  /**
   * Optional icon displayed before the title.
   * If not provided and `editModeConfig` is set, a default icon is used:
   * - `EditOutlined` if `isEditMode === true`
   * - `PlusOutlined` if `isEditMode === false`
   */
  icon?: IconType;

  /**
   * Test ID used for end-to-end or unit testing (e.g. Cypress, Testing Library).
   */
  dataTestId?: string;

  /**
   * Ant Design Typography title level (default: 5)
   */
  level?: 1 | 2 | 3 | 4 | 5;
};

export const ModalTitleWithIcon = ({
  editModeConfig,
  title,
  icon,
  dataTestId,
  level = 5,
}: ModalTitleWithIconProps) => {
  const theme = useTheme();
  const iconStyles = css`
    margin: auto ${theme.sizeUnit * 2}px auto 0;
  `;
  const titleStyles = css`
    && {
      margin: 0;
      margin-bottom: 0;
    }
  `;
  const renderedTitle = editModeConfig
    ? editModeConfig.isEditMode
      ? editModeConfig.titleEdit
      : editModeConfig.titleAdd
    : title;

  const renderedIcon = isValidElement(icon) ? (
    cloneElement(icon as React.ReactElement, { iconSize: 'l', css: iconStyles })
  ) : editModeConfig ? (
    editModeConfig.isEditMode ? (
      <Icons.EditOutlined iconSize="l" css={iconStyles} />
    ) : (
      <Icons.PlusOutlined iconSize="l" css={iconStyles} />
    )
  ) : null;

  return (
    <Typography.Title level={level} css={titleStyles} data-test={dataTestId}>
      {renderedIcon}
      {typeof renderedTitle === 'string' ? t(renderedTitle) : renderedTitle}
    </Typography.Title>
  );
};
