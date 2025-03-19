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
import Button from 'src/components/Button';
import { TooltipProps, TooltipPlacement } from 'antd/lib/tooltip';
import { Tooltip } from './index';

export default {
  title: 'Tooltip',
  component: Tooltip,
};

const PLACEMENTS: TooltipPlacement[] = [
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

const TRIGGERS = ['hover', 'focus', 'click', 'contextMenu'];

export const InteractiveTooltip = (args: TooltipProps) => (
  <Tooltip {...args}>
    <Button style={{ margin: '50px 100px' }}>Hover me</Button>
  </Tooltip>
);

InteractiveTooltip.args = {
  title: 'Simple tooltip text',
  mouseEnterDelay: 0.1,
  mouseLeaveDelay: 0.1,
};

InteractiveTooltip.argTypes = {
  placement: {
    defaultValue: 'top',
    control: { type: 'select' },
    options: PLACEMENTS,
  },
  trigger: {
    defaultValue: 'hover',
    control: { type: 'select' },
    options: TRIGGERS,
  },
  color: { control: { type: 'color' } },
  onVisibleChange: { action: 'onVisibleChange' },
};
