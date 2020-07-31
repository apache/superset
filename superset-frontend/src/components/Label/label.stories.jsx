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
import { action } from '@storybook/addon-actions';
import { withKnobs, boolean, select, text } from '@storybook/addon-knobs';
import Label from './index';

export default {
  title: 'Label',
  component: Label,
  decorators: [withKnobs],
};

const bsStyleKnob = {
  label: 'Types',
  options: {
    Danger: 'danger',
    Warning: 'warning',
    Success: 'success',
    Default: 'default',
  },
  defaultValue: 'default',
};

export const SupersetLabel = () => (
  <div style={{ padding: '10px' }}>
    <Label
      bsStyle={select(
        bsStyleKnob.label,
        bsStyleKnob.options,
        bsStyleKnob.defaultValue,
        bsStyleKnob.groupId,
      )}
      onClick={action('clicked')}
      tooltip={boolean('Tooltip', false) === true ? 'This is a tooltip!' : null}
    >
      {text('Label', 'Label!')}
    </Label>
  </div>
);
