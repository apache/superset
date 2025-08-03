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
import { css, useTheme } from '@superset-ui/core';
import { Typography, Icons, TitleProps } from '@superset-ui/core/components';
import type { IconType } from '@superset-ui/core/components/Icons/types';

type ModalTitleWithIconProps = Omit<TitleProps, 'title'> & {
  isEditMode?: boolean;
  title: React.ReactNode;
  icon?: IconType;
};

export const ModalTitleWithIcon = ({
  isEditMode,
  title,
  icon,
  level = 5,
  ...rest
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

  const renderedIcon = isValidElement(icon) ? (
    cloneElement(icon as React.ReactElement, { iconSize: 'l', css: iconStyles })
  ) : isEditMode === true ? (
    <Icons.EditOutlined iconSize="l" css={iconStyles} />
  ) : isEditMode === false ? (
    <Icons.PlusOutlined iconSize="l" css={iconStyles} />
  ) : null;

  return (
    <Typography.Title level={level} css={titleStyles} {...rest}>
      {renderedIcon}
      {title}
    </Typography.Title>
  );
};
