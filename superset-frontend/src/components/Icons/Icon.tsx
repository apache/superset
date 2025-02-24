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

import { FC, SVGProps, useEffect, useRef, useState } from 'react';
import AntdIcon from '@ant-design/icons';
import { styled } from '@superset-ui/core';
import TransparentIcon from 'src/assets/images/icons/transparent.svg';
import IconType from './IconType';

const BaseIconComponent: React.FC<
  IconType & { component?: React.ComponentType<any> }
> = ({
  component: Component,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  iconColor,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  iconSize,
  viewBox,
  // @ts-ignore
  customIcons,
  ...rest
}) => {
  if (!Component) return null;
  const isCustomIcon = Component && customIcons;

  return isCustomIcon ? (
    <span
      role="img"
      style={{
        fontSize: iconSize ? `${iconSize}px` : '24px',
        color: iconColor || 'inherit',
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      <AntdIcon
        viewBox={viewBox || '0 0 24 24'}
        component={Component as any}
        {...rest}
      />
    </span>
  ) : (
    Component && <Component {...rest} />
  );
};

// Ora definiamo StyledIcon come una versione stilizzata di BaseIcon.
export const StyledIcon = styled(BaseIconComponent)<IconType>`
  ${({ iconColor, theme }) =>
    `color: ${iconColor || theme.colors.grayscale.base};`}
  span {
    // Fixing alignement on some of the icons
    line-height: 0px;
  }
  font-size: ${({ iconSize, theme }) =>
    iconSize
      ? `${theme.typography.sizes[iconSize] || theme.typography.sizes.m}px`
      : '24px'};
`;

export interface IconProps extends IconType {
  fileName: string;
  customIcons?: boolean;
}

export const Icon = (props: IconProps & IconType) => {
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
    <StyledIcon
      component={ImportedSVG.current || TransparentIcon}
      aria-label={name}
      role={whatRole}
      {...iconProps}
    />
  );
};

export default Icon;
