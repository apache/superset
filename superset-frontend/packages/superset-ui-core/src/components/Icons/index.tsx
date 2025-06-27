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

import { FC } from 'react';
import { antdEnhancedIcons } from './AntdEnhanced';
import AsyncIcon from './AsyncIcon';

import type { IconType } from './types';

/**
 * Filename is going to be inferred from the icon name.
 * i.e. BigNumberChartTile => assets/images/icons/big_number_chart_tile
 */
const customIcons = [
  'Ballot',
  'BigNumberChartTile',
  'Binoculars',
  'Category',
  'Certified',
  'CheckboxHalf',
  'CheckboxOff',
  'CheckboxOn',
  'CircleSolid',
  'Drag',
  'ErrorSolidSmallRed',
  'Error',
  'Full',
  'Layers',
  'Queued',
  'Redo',
  'Running',
  'Slack',
  'Square',
  'SortAsc',
  'SortDesc',
  'Sort',
  'Transparent',
  'TriangleDown',
  'Undo',
] as const;

type CustomIconType = Record<(typeof customIcons)[number], FC<IconType>>;

const iconOverrides: CustomIconType = {} as CustomIconType;
customIcons.forEach(customIcon => {
  const fileName = customIcon
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
  iconOverrides[customIcon] = (props: IconType) => (
    <AsyncIcon customIcons fileName={fileName} {...props} />
  );
});

export type IconNameType =
  | keyof typeof antdEnhancedIcons
  | keyof typeof iconOverrides;

type IconComponentType = Record<IconNameType, FC<IconType>>;

export const Icons: IconComponentType = {
  ...antdEnhancedIcons,
  ...iconOverrides,
};
export type { IconType };
