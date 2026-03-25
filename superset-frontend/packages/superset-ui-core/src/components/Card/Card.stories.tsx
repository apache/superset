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
<<<<<<< HEAD:superset-frontend/packages/superset-ui-core/src/components/Card/Card.stories.tsx
import { Card } from '.';
import type { CardProps } from './types';
=======
import Slider, { SliderSingleProps, SliderRangeProps } from '.';
>>>>>>> origin/avenmaster:superset-frontend/src/components/Slider/Slider.stories.tsx

export default {
  title: 'Components/Card',
  component: Card,
};

<<<<<<< HEAD:superset-frontend/packages/superset-ui-core/src/components/Card/Card.stories.tsx
export const InteractiveCard = (args: CardProps) => <Card {...args} />;

InteractiveCard.args = {
  padded: true,
  title: 'Components/Card',
  children: 'Card content',
  bordered: true,
  loading: false,
  hoverable: false,
};

InteractiveCard.argTypes = {
  onClick: {
    table: {
      disable: true,
    },
    action: 'onClick',
  },
  theme: {
    table: {
      disable: true,
    },
=======
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
  marks: {},
  disabled: false,
  reverse: false,
  vertical: false,
  autoFocus: false,
  keyboard: true,
  dots: false,
  included: true,
  tooltipPosition: 'bottom',
};

InteractiveSlider.argTypes = {
  onChange: { action: 'onChange' },
  onChangeComplete: { action: 'onChangeComplete' },
  tooltipOpen: {
    control: { type: 'boolean' },
  },
  tooltipPosition: {
    options: tooltipPlacement,
    control: { type: 'select' },
>>>>>>> origin/avenmaster:superset-frontend/src/components/Slider/Slider.stories.tsx
  },
};

InteractiveRangeSlider.args = {
  ...InteractiveSlider.args,
  defaultValue: [50, 70],
  draggableTrack: false,
};

InteractiveRangeSlider.argTypes = InteractiveSlider.argTypes;
