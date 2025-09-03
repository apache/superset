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

import { css, useTheme, getFontSize } from '../..';
import { AntdIconType, BaseIconProps, CustomIconType, IconType } from './types';

const genAriaLabel = (fileName: string) => {
  const name = fileName.replace(/_/g, '-'); // Replace underscores with dashes
  const words = name.split(/(?<=[a-z])(?=[A-Z])/); // Split at lowercase-to-uppercase transitions

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
  fileName,
  ...rest
}) => {
  const theme = useTheme();
  const whatRole = rest?.onClick ? 'button' : 'img';
  const ariaLabel = genAriaLabel(fileName || '');
  const style = {
    color: iconColor,
    fontSize: iconSize
      ? `${getFontSize(theme, iconSize)}px`
      : `${theme.fontSize}px`,
    cursor: rest?.onClick ? 'pointer' : undefined,
  };

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
      ]}
    >
      <Component
        viewBox={viewBox || '0 0 24 24'}
        style={style}
        width={
          iconSize
            ? `${getFontSize(theme, iconSize) || theme.fontSize}px`
            : `${theme.fontSize}px`
        }
        height={
          iconSize
            ? `${getFontSize(theme, iconSize) || theme.fontSize}px`
            : `${theme.fontSize}px`
        }
        {...(rest as CustomIconType)}
      />
    </span>
  ) : (
    <Component
      role={whatRole}
      style={style}
      aria-label={ariaLabel}
      data-test={ariaLabel}
      {...(rest as AntdIconType)}
    />
  );
};
