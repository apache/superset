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

import {
  FC,
  SVGProps,
  useEffect,
  useRef,
  useState,
  ComponentType,
} from 'react';
import { styled, css } from '@superset-ui/core';
import TransparentIcon from 'src/assets/images/icons/transparent.svg';
import IconType from './IconType';

interface BaseIconProps extends SVGProps<SVGSVGElement> {
  component?: ComponentType<SVGProps<SVGSVGElement>>;
  iconColor?: IconType['iconColor']
  iconSize?: IconType['iconSize'];
}

const BaseIconComponent: React.FC<BaseIconProps> = ({
  component: Component,
  iconColor,
  iconSize,
  viewBox = '0 0 24 24',
  // @ts-ignore
  customIcons,
  ...rest
}) => {
  if (!Component) return null;
  return customIcons ? (
    <span
      role={rest?.onClick ? 'button' : 'img'}
      css={(theme) => css`
        font-size: ${iconSize
          ? `${theme.typography.sizes[iconSize] || theme.typography.sizes.m}px`
          : '24px'};
        color: ${iconColor || theme.colors.grayscale.base};
        display: inline-flex;
        align-items: center;
      `}
    >
      <Component
        {...rest}
        viewBox={viewBox}
        fill={iconColor}
      />
    </span>
  ) : (
    <Component {...(rest as SVGProps<SVGSVGElement>)} />
  );
};

export const StyledIcon = styled(BaseIconComponent) <BaseIconProps & IconType>`
  ${({ iconColor, theme }) =>
    `color: ${iconColor || theme.colors.grayscale.base};`}
    font-size: ${({ iconSize, theme }) =>
    iconSize
      ? `${theme.typography.sizes[iconSize] || theme.typography.sizes.m}px`
      : '24px'};
    `;

export interface IconProps extends IconType {
  fileName: string;
  customIcons?: boolean;
}

export const Icon = (props: IconProps) => {
  const { fileName, ...iconProps } = props;
  const [, setLoaded] = useState(false);
  const ImportedSVG = useRef<FC<SVGProps<SVGSVGElement>>>();
  const name = fileName.replace('_', '-');

  useEffect(() => {
    let cancelled = false;
    async function importIcon(): Promise<void> {
      ImportedSVG.current = (
        await import(`!!@svgr/webpack!src/assets/images/icons/${fileName}.svg`)
      ).default;
      if (!cancelled) {
        setLoaded(true);
      }
    }
    importIcon();
    return () => {
      cancelled = true;
    };
  }, [fileName, ImportedSVG]);

  const whatRole = props?.onClick ? 'button' : 'img';
  return (
    // @ts-ignore to be removed
    <StyledIcon
      component={ImportedSVG.current || TransparentIcon}
      aria-label={name}
      role={whatRole}
      {...iconProps}
    />
  );
};

export default Icon;
