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
import React, { useState } from 'react';
import { SupersetTheme } from '@superset-ui/core';
import DvtTextarea, { DvtTextareaProps } from '.';

export default {
  title: 'Dvt-Components/DvtTextarea',
  component: DvtTextarea,
};

export const Default = (args: DvtTextareaProps) => {
  const [text, setText] = useState<string>('');
  return (
    <div
      css={(theme: SupersetTheme) => ({
        backgroundColor: theme.colors.dvt.grayscale.light2,
        padding: '40px',
      })}
    >
      <div style={{ width: '226px' }}>
        <DvtTextarea {...args} value={text} onChange={setText} />
      </div>
    </div>
  );
};

Default.argTypes = {
  label: {
    control: { type: 'text' },
    defaultValue: 'SQL QUERY',
  },
  typeDesign: {
    control: { type: 'select' },
    defaultValue: 'text',
  },
  placeholder: {
    control: { type: 'text' },
    defaultValue: 'Default',
  },
};

export const Form = (args: DvtTextareaProps) => {
  const [text, setText] = useState<string>('');
  return (
    <div
      css={(theme: SupersetTheme) => ({
        backgroundColor: theme.colors.dvt.grayscale.light2,
        padding: '40px',
      })}
    >
      <div style={{ width: '226px' }}>
        <DvtTextarea {...args} value={text} onChange={setText} />
      </div>
    </div>
  );
};

Form.argTypes = {
  label: {
    control: { type: 'text' },
    defaultValue: 'SQL QUERY',
  },
  typeDesign: {
    control: { type: 'select' },
    defaultValue: 'form',
  },
};

export const Border = (args: DvtTextareaProps) => {
  const [text, setText] = useState<string>('');
  return (
    <div
      css={(theme: SupersetTheme) => ({
        backgroundColor: theme.colors.dvt.grayscale.light2,
        padding: '40px',
      })}
    >
      <div style={{ width: '226px' }}>
        <DvtTextarea {...args} value={text} onChange={setText} />
      </div>
    </div>
  );
};

Border.argTypes = {
  label: {
    control: { type: 'text' },
    defaultValue: 'SQL QUERY',
  },
  typeDesign: {
    control: { type: 'select' },
    defaultValue: 'border',
  },
};

export const Resize = (args: DvtTextareaProps) => {
  const [text, setText] = useState<string>('');
  return (
    <div
      css={(theme: SupersetTheme) => ({
        backgroundColor: theme.colors.dvt.grayscale.light2,
        padding: '40px',
      })}
    >
      <div style={{ width: '226px' }}>
        <DvtTextarea {...args} value={text} onChange={setText} />
      </div>
    </div>
  );
};

Resize.argTypes = {
  label: {
    control: { type: 'text' },
    defaultValue: 'SQL QUERY',
  },
  typeDesign: {
    control: { type: 'select' },
    defaultValue: 'resize',
  },
};
