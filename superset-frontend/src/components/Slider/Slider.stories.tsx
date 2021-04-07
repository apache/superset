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
import Slider, { SliderSingleProps } from '.';

export default {
  title: 'Slider',
  component: Slider,
};

export const InteractiveSlider = (args: SliderSingleProps) => (
  <Slider {...args} style={{ width: 400, height: 400 }} />
);

InteractiveSlider.args = {
  min: 0,
  max: 100,
  defaultValue: 70,
  step: 1,
};

InteractiveSlider.argTypes = {
  onChange: { action: 'onChange' },
  disabled: {
    control: { type: 'boolean' },
  },
  reverse: {
    control: { type: 'boolean' },
  },
  vertical: {
    control: { type: 'boolean' },
  },
};

InteractiveSlider.story = {
  parameters: {
    knobs: {
      disable: true,
    },
  },
};
