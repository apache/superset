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
import { PopoverProps } from 'antd/lib/popover';
import React from 'react';
import Popover from '.';

export default {
  title: 'Popover',
  component: Popover,
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

const PLACEMENTS = {
  label: 'placement',
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
  defaultValue: null,
};

const TRIGGERS = {
  label: 'trigger',
  options: ['hover', 'click', 'focus'],
  defaultValue: null,
};

InteractivePopover.args = {
  content: 'Popover sample content',
  title: 'Popover title',
};

InteractivePopover.argTypes = {
  placement: {
    name: PLACEMENTS.label,
    control: { type: 'select', options: PLACEMENTS.options },
  },
  trigger: {
    name: TRIGGERS.label,
    control: { type: 'select', options: TRIGGERS.options },
  },
};
