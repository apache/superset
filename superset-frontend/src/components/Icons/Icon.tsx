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

import React from 'react';
import AntdIcon from '@ant-design/icons';
import { styled } from '@superset-ui/core';
import { CustomIconComponentProps } from '@ant-design/icons/lib/components/Icon';
import IconType from './IconType';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const EnhancedIcon = ({ iconColor, iconSize, ...rest }: IconType) => (
  <AntdIcon viewBox={rest.viewBox || '0 0 24 24'} {...rest} />
);

const Icon = styled(EnhancedIcon)<IconType>`
  ${({ iconColor }) => iconColor && `color: ${iconColor};`};
  font-size: ${({ iconSize, theme }) =>
    iconSize ? `${theme.typography.sizes[iconSize]}px` : '24px'};
`;

export const renderIcon = (
  SVGComponent:
    | React.ComponentClass<
        CustomIconComponentProps | React.SVGProps<SVGSVGElement>,
        any
      >
    | React.FunctionComponent<
        CustomIconComponentProps | React.SVGProps<SVGSVGElement>
      >
    | undefined,
  props: IconType,
) => <Icon component={SVGComponent} {...props} />;

export default Icon;
