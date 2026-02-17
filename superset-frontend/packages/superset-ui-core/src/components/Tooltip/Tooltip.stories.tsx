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
import { Button } from '../Button';
import { Tooltip } from '.';
import { TooltipProps } from './types';

export default {
  title: 'Components/Tooltip',
  component: Tooltip,
};

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
  title: {
    control: { type: 'text' },
    description: 'Text or content shown in the tooltip.',
  },
  placement: {
    control: { type: 'select' },
    options: [
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
    ],
    description: 'Position of the tooltip relative to the trigger element.',
  },
  trigger: {
    control: { type: 'select' },
    options: ['hover', 'focus', 'click', 'contextMenu'],
    description: 'How the tooltip is triggered.',
  },
  mouseEnterDelay: {
    control: { type: 'number' },
    description: 'Delay in seconds before showing the tooltip on hover.',
  },
  mouseLeaveDelay: {
    control: { type: 'number' },
    description:
      'Delay in seconds before hiding the tooltip after mouse leave.',
  },
  color: {
    control: { type: 'color' },
    description: 'Custom background color for the tooltip.',
  },
  onVisibleChange: { action: 'onVisibleChange' },
};

InteractiveTooltip.parameters = {
  docs: {
    sampleChildren: [
      {
        component: 'Button',
        props: { children: 'Hover me' },
      },
    ],
    liveExample: `function Demo() {
  return (
    <Tooltip title="This is a helpful tooltip">
      <Button>Hover me</Button>
    </Tooltip>
  );
}`,
    examples: [
      {
        title: 'Placements',
        code: `function Placements() {
  const placements = ['top', 'bottom', 'left', 'right', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {placements.map(placement => (
        <Tooltip key={placement} title={placement} placement={placement}>
          <Button>{placement}</Button>
        </Tooltip>
      ))}
    </div>
  );
}`,
      },
      {
        title: 'Trigger Types',
        code: `function Triggers() {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <Tooltip title="Hover trigger" trigger="hover">
        <Button>Hover</Button>
      </Tooltip>
      <Tooltip title="Click trigger" trigger="click">
        <Button>Click</Button>
      </Tooltip>
      <Tooltip title="Focus trigger" trigger="focus">
        <Button>Focus</Button>
      </Tooltip>
    </div>
  );
}`,
      },
    ],
  },
};
