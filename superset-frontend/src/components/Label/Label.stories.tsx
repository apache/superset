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
import { withKnobs, select, boolean, text } from '@storybook/addon-knobs';
import Label from './index';

export default {
  title: 'Label',
  component: Label,
  decorators: [withKnobs],
  excludeStories: /.*Knob$/,
};

export const bsStyleKnob = {
  label: 'Types',
  options: {
    default: 'default',
    info: 'info',
    success: 'success',
    warning: 'warning',
    danger: 'danger',
    secondary: 'secondary',
    primary: 'primary',
  },
  defaultValue: 'default',
};

export const LabelGallery = () => (
  <>
    <h4>Non-interactive</h4>
    {Object.values(bsStyleKnob.options).map(opt => (
      <Label key={opt} bsStyle={opt}>
        {`style: "${opt}"`}
      </Label>
    ))}
    <br />
    <h4>Interactive</h4>
    {Object.values(bsStyleKnob.options).map(opt => (
      <Label key={opt} bsStyle={opt} onClick={action('clicked')}>
        {`style: "${opt}"`}
      </Label>
    ))}
  </>
);

export const InteractiveLabel = () => (
  <Label
    bsStyle={select(
      bsStyleKnob.label,
      bsStyleKnob.options,
      bsStyleKnob.defaultValue,
    )}
    onClick={
      boolean('Has onClick action', false) ? action('clicked') : undefined
    }
  >
    {text('Label', 'Label!')}
  </Label>
);
