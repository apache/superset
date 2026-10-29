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
import Slider, { SliderSingleProps, SliderRangeProps } from '.';

export default {
  title: 'Components/Slider',
  component: Slider,
  parameters: {
    docs: {
      description: {
        component:
          'A slider input for selecting a value or range from a continuous or stepped interval. Supports single value, range, vertical orientation, marks, and tooltip display.',
      },
    },
  },
};

const tooltipPlacement = [
  'top',
  'left',
  'bottom',
  'right',
  'topLeft',
  'topRight',
  'bottomLeft',
  'bottomRight',
  'leftTop',
  'leftBottom',
  'rightTop',
  'rightBottom',
] as const;

export const InteractiveSlider = ({
  tooltipOpen,
  tooltipPosition,
  ...args
}: SliderSingleProps & {
  tooltipOpen: boolean;
  tooltipPosition: (typeof tooltipPlacement)[number];
}) => (
  <Slider
    {...args}
    tooltip={{
      ...args.tooltip,
      open: tooltipOpen,
      placement: tooltipPosition,
    }}
    style={{ width: 400, height: 400 }}
  />
);

export const InteractiveRangeSlider = ({
  tooltipOpen,
  draggableTrack,
  ...args
}: SliderRangeProps & { tooltipOpen: boolean; draggableTrack: boolean }) => (
  <Slider
    {...args}
    tooltip={{ open: tooltipOpen }}
    range={{ draggableTrack }}
    style={{ width: 400, height: 400 }}
  />
);

InteractiveSlider.args = {
  min: 0,
  max: 100,
  defaultValue: 70,
  step: 1,
  disabled: false,
  reverse: false,
  vertical: false,
  keyboard: true,
  dots: false,
  included: true,
};

InteractiveSlider.argTypes = {
  min: {
    control: { type: 'number' },
    description: 'Minimum value of the slider.',
  },
  max: {
    control: { type: 'number' },
    description: 'Maximum value of the slider.',
  },
  defaultValue: {
    control: { type: 'number' },
    description: 'Initial value of the slider.',
  },
  step: {
    control: { type: 'number' },
    description: 'Step increment between values. Use null for marks-only mode.',
  },
  disabled: {
    control: 'boolean',
    description: 'Whether the slider is disabled.',
  },
  reverse: {
    control: 'boolean',
    description: 'Whether to reverse the slider direction.',
  },
  vertical: {
    control: 'boolean',
    description: 'Whether to display the slider vertically.',
  },
  keyboard: {
    control: 'boolean',
    description: 'Whether keyboard arrow keys can control the slider.',
  },
  dots: {
    control: 'boolean',
    description: 'Whether to show dots at each step mark.',
  },
  included: {
    control: 'boolean',
    description: 'Whether to highlight the filled portion of the track.',
  },
  tooltipOpen: {
    control: 'boolean',
    description: 'Whether the value tooltip is always visible.',
  },
  tooltipPosition: {
    control: { type: 'select' },
    options: [
      'top',
      'left',
      'bottom',
      'right',
      'topLeft',
      'topRight',
      'bottomLeft',
      'bottomRight',
      'leftTop',
      'leftBottom',
      'rightTop',
      'rightBottom',
    ],
    description: 'Position of the value tooltip relative to the handle.',
  },
  onChange: { action: 'onChange' },
  onChangeComplete: { action: 'onChangeComplete' },
};

InteractiveSlider.parameters = {
  docs: {
    liveExample: `function Demo() {
  return (
    <div style={{ width: 400, padding: '20px 0' }}>
      <Slider
        min={0}
        max={100}
        defaultValue={70}
        step={1}
      />
    </div>
  );
}`,
    examples: [
      {
        title: 'Range Slider',
        code: `function RangeSliderDemo() {
  return (
    <div style={{ width: 400, padding: '20px 0' }}>
      <h4>Basic Range</h4>
      <Slider range defaultValue={[20, 70]} min={0} max={100} />
      <br />
      <h4>Draggable Track</h4>
      <Slider range={{ draggableTrack: true }} defaultValue={[30, 60]} min={0} max={100} />
    </div>
  );
}`,
      },
      {
        title: 'With Marks',
        code: `function MarksDemo() {
  return (
    <div style={{ width: 400, padding: '20px 0' }}>
      <Slider
        min={0}
        max={100}
        defaultValue={37}
        marks={{
          0: '0°C',
          25: '25°C',
          50: '50°C',
          75: '75°C',
          100: '100°C',
        }}
      />
    </div>
  );
}`,
      },
      {
        title: 'Stepped and Dots',
        code: `function SteppedDemo() {
  return (
    <div style={{ width: 400, padding: '20px 0' }}>
      <h4>Step = 10 with Dots</h4>
      <Slider min={0} max={100} defaultValue={30} step={10} dots />
      <br />
      <h4>Step = 25</h4>
      <Slider min={0} max={100} defaultValue={50} step={25} dots
        marks={{ 0: '0', 25: '25', 50: '50', 75: '75', 100: '100' }} />
    </div>
  );
}`,
      },
      {
        title: 'Vertical Slider',
        code: `function VerticalDemo() {
  return (
    <div style={{ height: 300, display: 'flex', gap: 40, padding: '0 40px' }}>
      <Slider vertical defaultValue={30} />
      <Slider vertical range defaultValue={[20, 60]} />
      <Slider vertical defaultValue={50} dots step={10}
        marks={{ 0: '0', 50: '50', 100: '100' }} />
    </div>
  );
}`,
      },
    ],
  },
};

InteractiveRangeSlider.args = {
  min: 0,
  max: 100,
  defaultValue: [50, 70],
  step: 1,
  disabled: false,
  reverse: false,
  vertical: false,
  keyboard: true,
  dots: false,
  included: true,
  draggableTrack: false,
};

InteractiveRangeSlider.argTypes = {
  ...InteractiveSlider.argTypes,
  draggableTrack: {
    control: 'boolean',
    description:
      'Whether the track between handles can be dragged to move both handles together.',
  },
};
