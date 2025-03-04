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
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS
 * of any kind, either express or implied.  See the License
 * for the specific language governing permissions and
 * limitations under the License.
 */

import { FC, SVGProps, useEffect, useRef, useState } from 'react';
import AntdIcon from '@ant-design/icons';
import TransparentIcon from 'src/assets/images/icons/transparent.svg';
import { themeObject, styled } from '@superset-ui/core';
import IconType from './IconType';

// Customized AntdIconComponent that filters unnecessary props
const AntdIconComponent = ({
  iconColor,
  iconSize,
  viewBox,
  ...rest
}: Omit<IconType, 'ref' | 'css'>) => (
  // Ensure props like iconColor and iconSize don't get passed to the DOM
  <AntdIcon
    viewBox={viewBox || '0 0 24 24'}
    style={{
      color: iconColor, // Use iconColor explicitly
    }}
    {...rest}
  />
);
// Styled version of AntdIconComponent
export const StyledIcon = styled(AntdIconComponent)<IconType>`
  ${({ iconColor }) => iconColor && `color: ${iconColor};`};
  span {
    // Fixing alignment on some of the icons
    line-height: 0px;
  }
  font-size: ${({ iconSize }) =>
    iconSize ? themeObject.getFontSize(iconSize) : 24}px;
`;

export interface IconProps extends IconType {
  fileName: string;
}

export const Icon = (props: IconProps) => {
  const { fileName, iconColor, iconSize, ...rest } = props;
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
      iconColor={iconColor} // Handled explicitly in StyledIcon
      iconSize={iconSize} // Handled explicitly in StyledIcon
      {...rest} // Pass remaining valid props
    />
  );
};

export default Icon;
