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
import Button from './index';

export default {
  title: 'Button',
  component: Button,
  includeStories: ['ButtonGallery', 'InteractiveButton'],
};

export const STYLES = {
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

export const SIZES = {
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

const TYPES = {
  label: 'Type',
  options: {
    Submit: 'submit',
    Button: 'button',
    None: null,
  },
  defaultValue: null,
};
const TARGETS = {
  label: 'Target',
  options: {
    Blank: '_blank',
    None: null,
  },
  defaultValue: null,
};
const HREFS = {
  label: 'HREF',
  options: {
    Superset: 'http://https://superset.incubator.apache.org/',
    None: null,
  },
  defaultValue: null,
};

export const ButtonGallery = () => (
  <>
    {Object.entries(SIZES.options).map(([name, size]) => (
      <div key={size}>
        <h4>{name}</h4>
        {Object.values(STYLES.options)
          .filter(o => o)
          .map(style => (
            <Button
              buttonStyle={style}
              buttonSize={size}
              onClick={() => true}
              key={`${style}_${size}`}
            >
              {style}
            </Button>
          ))}
      </div>
    ))}
  </>
);

export const InteractiveButton = args => {
  const { label, ...btnArgs } = args;
  return <Button {...btnArgs}>{label}</Button>;
};

InteractiveButton.args = {
  buttonStyle: STYLES.defaultValue,
  size: SIZES.defaultValue,
  type: TYPES.defaultValue,
  target: TARGETS.defaultValue,
  href: HREFS.defaultValue,
  label: 'Button!',
};
InteractiveButton.argTypes = {
  buttonStyle: {
    name: STYLES.label,
    control: { type: 'select', options: Object.values(STYLES.options) },
  },
  size: {
    name: SIZES.label,
    control: { type: 'select', options: Object.values(SIZES.options) },
  },
  type: {
    name: TYPES.label,
    control: { type: 'select', options: Object.values(TYPES.options) },
  },
  target: {
    name: TARGETS.label,
    control: { type: 'select', options: Object.values(TARGETS.options) },
  },
  href: {
    name: HREFS.label,
    control: { type: 'select', options: Object.values(HREFS.options) },
  },
  onClick: { action: 'clicked' },
  label: { name: 'Label', control: { type: 'text' } },
};

ButtonGallery.argTypes = { onClick: { action: 'clicked' } };
