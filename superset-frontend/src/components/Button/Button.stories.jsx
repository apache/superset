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
import Button from './index';

export default {
  title: 'Button',
  component: Button,
  decorators: [withKnobs],
  excludeStories: /.*Knob$/,
};

export const buttonStyleKnob = {
  label: 'Types',
  options: {
    Primary: 'primary',
    Secondary: 'secondary',
    Tertiary: 'tertiary',
    Dashed: 'dashed',
    Danger: 'danger',
    Warning: 'warning',
    Success: 'success',
    Link: 'link',
    Default: 'default',
    None: null,
  },
  defaultValue: null,
  // groupId: 'ButtonType',
};

export const buttonSizeKnob = {
  label: 'Sizes',
  options: {
    XS: 'xsmall',
    S: 'small',
    Default: null,
    L: 'large',
  },
  defaultValue: null,
};

// TODO remove the use of these in the codebase where they're not necessary
// const classKnob = {
//   label: 'Known Classes',
//   options: {
//     Refresh: 'refresh-btn',
//     Primary: 'btn-primary',
//     Reset: 'reset',
//     Fetch: 'fetch',
//     Query: 'query',
//     MR3: 'm-r-3',
//     cancelQuery: 'cancelQuery',
//     toggleSave: 'toggleSave',
//     toggleSchedule: 'toggleSchedule',
//     autocomplete: 'autocomplete',
//     OK: 'ok',
//     None: null,
//   },
//   defaultValue: null,
// };
const typeKnob = {
  label: 'Type',
  options: {
    Submit: 'submit',
    Button: 'button',
    None: null,
  },
  defaultValue: null,
};
const targetKnob = {
  label: 'Target',
  options: {
    Blank: '_blank',
    None: null,
  },
  defaultValue: null,
};
const hrefKnob = {
  label: 'HREF',
  options: {
    Superset: 'http://https://superset.incubator.apache.org/',
    None: null,
  },
  defaultValue: null,
};

export const ButtonGallery = () => (
  <>
    {Object.entries(buttonSizeKnob.options).map(([name, size]) => (
      <div key={size}>
        <h4>{name}</h4>
        {Object.values(buttonStyleKnob.options)
          .filter(o => o)
          .map(style => (
            <Button
              disabled={boolean('Disabled', false)}
              cta={boolean('CTA', false)}
              buttonStyle={style}
              buttonSize={size}
              onClick={action('clicked')}
              key={`${style}_${size}`}
            >
              {style}
            </Button>
          ))}
      </div>
    ))}
  </>
);

export const InteractiveButton = () => (
  <Button
    disabled={boolean('Disabled', false)}
    cta={boolean('CTA', false)}
    buttonStyle={select(
      buttonStyleKnob.label,
      buttonStyleKnob.options,
      buttonStyleKnob.defaultValue,
      buttonStyleKnob.groupId,
    )}
    size={select(
      buttonSizeKnob.label,
      buttonSizeKnob.options,
      buttonSizeKnob.defaultValue,
      buttonSizeKnob.groupId,
    )}
    onClick={action('clicked')}
    type={select(
      typeKnob.label,
      typeKnob.options,
      typeKnob.defaultValue,
      typeKnob.groupId,
    )}
    target={select(
      targetKnob.label,
      targetKnob.options,
      targetKnob.defaultValue,
      targetKnob.groupId,
    )}
    href={select(
      hrefKnob.label,
      hrefKnob.options,
      hrefKnob.defaultValue,
      hrefKnob.groupId,
    )}
    tooltip={boolean('Tooltip', false) === true ? 'This is a tooltip!' : null}
  >
    {text('Label', 'Button!')}
  </Button>
);
