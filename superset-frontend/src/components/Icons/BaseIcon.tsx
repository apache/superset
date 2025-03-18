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

import { css, useTheme } from '@superset-ui/core';
import { AntdIconType, BaseIconProps, CustomIconType, IconType } from './types';

const genAriaLabel = (fileName: string) => {
  const name = fileName.replace(/_/g, '-'); // Replace underscores with dashes
  const words = name.split(/(?=[A-Z])/); // Split at uppercase letters

  if (words.length === 2) {
    return words[0].toLowerCase();
  }

  if (words.length >= 3) {
    return `${words[0].toLowerCase()}-${words[1].toLowerCase()}`;
  }

  return name.toLowerCase();
};

export const BaseIconComponent: React.FC<
  BaseIconProps & Omit<IconType, 'component'>
> = ({
  component: Component,
  iconColor,
  iconSize,
  viewBox,
  customIcons,
  ...rest
}) => {
  const theme = useTheme();
  const iconCss = css`
    color: ${iconColor || theme.colors.grayscale.base};
    font-size: ${iconSize
      ? `${theme.typography.sizes[iconSize] || theme.typography.sizes.m}px`
      : '24px'};
  `;
  const whatRole = rest?.onClick ? 'button' : 'img';
  const ariaLabel = genAriaLabel(rest.fileName || '');

  return customIcons ? (
    <span
      role={whatRole}
      aria-label={ariaLabel}
      data-test={ariaLabel}
      css={[
        css`
          display: inline-flex;
          align-items: center;
          line-height: 0;
          vertical-align: middle;
        `,
        iconCss,
      ]}
    >
      <Component
        viewBox={viewBox || '0 0 24 24'}
        width={
          iconSize
            ? `${theme.typography.sizes[iconSize] || theme.typography.sizes.m}px`
            : '24px'
        }
        height={
          iconSize
            ? `${theme.typography.sizes[iconSize] || theme.typography.sizes.m}px`
            : '24px'
        }
        {...(rest as CustomIconType)}
      />
    </span>
  ) : (
    <Component
      css={iconCss}
      role={whatRole}
      aria-label={ariaLabel}
      data-test={ariaLabel}
      {...(rest as AntdIconType)}
    />
  );
};
