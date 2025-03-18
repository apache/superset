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
import { startCase } from 'lodash';
import AntdEnhancedIcons from './AntdEnhanced';
import Icon from './Icon';
import IconType from './types';

const IconFileNames = [
  // to keep custom
  'ballot',
  'big-number-chart-tile',
  'binoculars',
  'category',
  'certified',
  'checkbox-half',
  'checkbox-off',
  'checkbox-on',
  'circle_solid',
  'drag',
  'error_solid_small_red',
  'error',
  'full',
  'layers',
  'queued',
  'redo',
  'running',
  'slack',
  'square',
  'sort_asc',
  'sort_desc',
  'sort',
  'transparent',
  'triangle_down',
  'undo',
];

const iconOverrides: Record<string, FC<IconType>> = {};
IconFileNames.forEach(fileName => {
  const keyName = startCase(fileName).replace(/ /g, '');
  iconOverrides[keyName] = (props: IconType) => (
    <Icon customIcons fileName={fileName} {...props} />
  );
});

export type { IconType };

export default {
  ...AntdEnhancedIcons,
  ...iconOverrides,
};
