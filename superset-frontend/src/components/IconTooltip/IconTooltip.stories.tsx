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
import Icons from 'src/components/Icons';
import { css, useTheme } from '@superset-ui/core';
import { IconTooltip, Props } from '.';

export default {
  title: 'IconTooltip',
};

const PLACEMENTS = [
  'bottom',
  'bottomLeft',
  'bottomRight',
  'left',
  'leftBottom',
  'leftTop',
  'right',
  'rightBottom',
  'rightTop',
  'top',
  'topLeft',
  'topRight',
];

const theme = useTheme();

export const InteractiveIconTooltip = (args: Props) => (
  <div
    css={css`
      margin: ${theme.gridUnit * 10}px ${theme.gridUnit * 17.5}px;
    `}
  >
    <IconTooltip {...args}>
      <Icons.InfoCircleOutlined />
    </IconTooltip>
  </div>
);

InteractiveIconTooltip.args = {
  tooltip: 'Tooltip',
};

InteractiveIconTooltip.argTypes = {
  placement: {
    defaultValue: 'top',
    control: { type: 'select' },
    options: PLACEMENTS,
  },
};
