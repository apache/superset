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
import { Popover, PopoverProps } from '@superset-ui/core/components/Popover';
import { Button } from '../Button';

export default {
  title: 'Components/Popover',
  component: Popover,
  parameters: {
    docs: {
      description: {
        component:
          'A floating card that appears when hovering or clicking a trigger element. Supports configurable placement, trigger behavior, and custom content.',
      },
    },
  },
};

export const InteractivePopover = (args: PopoverProps) => (
  <Popover {...args}>
    <Button
      style={{
        display: 'block',
        margin: '80px auto',
      }}
    >
      I am a button
    </Button>
  </Popover>
);

InteractivePopover.args = {
  content: 'Popover sample content',
  title: 'Popover title',
  arrow: true,
  color: '#fff',
};

InteractivePopover.argTypes = {
  content: {
    control: 'text',
    description: 'Content displayed inside the popover body.',
  },
  title: {
    control: 'text',
    description: 'Title displayed in the popover header.',
  },
  placement: {
    control: { type: 'select' },
    options: [
      'topLeft',
      'top',
      'topRight',
      'leftTop',
      'left',
      'leftBottom',
      'rightTop',
      'right',
      'rightBottom',
      'bottomLeft',
      'bottom',
      'bottomRight',
    ],
    description: 'Position of the popover relative to the trigger element.',
  },
  trigger: {
    control: { type: 'select' },
    options: ['hover', 'click', 'focus'],
    description: 'Event that triggers the popover to appear.',
  },
  arrow: {
    control: { type: 'boolean' },
    description: "Whether to show the popover's arrow pointing to the trigger.",
  },
  color: {
    control: { type: 'color' },
    description: 'The background color of the popover.',
  },
};

InteractivePopover.parameters = {
  docs: {
    sampleChildren: [
      { component: 'Button', props: { children: 'Hover me' } },
    ],
    liveExample: `function Demo() {
  return (
    <Popover
      content="Popover sample content"
      title="Popover title"
      arrow
    >
      <Button>Hover me</Button>
    </Popover>
  );
}`,
    examples: [
      {
        title: 'Click Trigger',
        code: `function ClickPopover() {
  return (
    <Popover
      content="This popover appears on click."
      title="Click Popover"
      trigger="click"
    >
      <Button>Click me</Button>
    </Popover>
  );
}`,
      },
      {
        title: 'Placements',
        code: `function PlacementsDemo() {
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', padding: '60px 0' }}>
      {['top', 'right', 'bottom', 'left'].map(placement => (
        <Popover
          key={placement}
          content={\`This popover is placed on the \${placement}\`}
          title={placement}
          placement={placement}
        >
          <Button>{placement}</Button>
        </Popover>
      ))}
    </div>
  );
}`,
      },
      {
        title: 'Rich Content',
        code: `function RichPopover() {
  return (
    <Popover
      title="Dashboard Info"
      content={
        <div>
          <p><strong>Created by:</strong> Admin</p>
          <p><strong>Last modified:</strong> Jan 2025</p>
          <p><strong>Charts:</strong> 12</p>
        </div>
      }
    >
      <Button buttonStyle="primary">
        <Icons.InfoCircleOutlined /> View Details
      </Button>
    </Popover>
  );
}`,
      },
    ],
  },
};
