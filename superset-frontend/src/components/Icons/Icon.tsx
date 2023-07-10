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

import React, { useEffect, useRef, useState } from 'react';
import AntdIcon from '@ant-design/icons';
import { styled } from '@superset-ui/core';
import TransparentIcon from 'src/assets/images/icons/transparent.svg';
import IconType from './IconType';

const AntdIconComponent = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  iconColor,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  iconSize,
  viewBox,
  ...rest
}: Omit<IconType, 'ref' | 'css'>) => (
  <AntdIcon viewBox={viewBox || '0 0 24 24'} {...rest} />
);

export const StyledIcon = styled(AntdIconComponent)<IconType>`
  ${({ iconColor }) => iconColor && `color: ${iconColor};`};
  font-size: ${({ iconSize, theme }) =>
    iconSize
      ? `${theme.typography.sizes[iconSize] || theme.typography.sizes.m}px`
      : '24px'};
`;

export interface IconProps extends IconType {
  fileName: string;
}

export const Icon = (props: IconProps) => {
  const { fileName, ...iconProps } = props;
  const [, setLoaded] = useState(false);
  const ImportedSVG = useRef<React.FC<React.SVGProps<SVGSVGElement>>>();
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

  return (
    <StyledIcon
      component={ImportedSVG.current || TransparentIcon}
      aria-label={name}
      {...iconProps}
    />
  );
};

export default Icon;
