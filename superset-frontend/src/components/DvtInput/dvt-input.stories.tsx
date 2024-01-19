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
import DvtInput, { DvtInputProps } from './index';

export default {
  title: 'Dvt-Components/DvtInput',
  component: DvtInput,
};

export const Default = (args: DvtInputProps) => {
  const [text, setText] = useState<string>('');
  return (
    <div style={{ width: 404 }}>
      <DvtInput {...args} value={text} onChange={setText} />
    </div>
  );
};

Default.argTypes = {
  type: {
    control: { type: 'select' },
    defaultValue: 'Text',
  },
  placeholder: {
    control: { type: 'text' },
    defaultValue: 'Default',
  },
};

export const Email = (args: DvtInputProps) => {
  const [text, setText] = useState<string>('');
  return (
    <div style={{ width: 404 }}>
      <DvtInput {...args} value={text} onChange={setText} />
    </div>
  );
};

Email.argTypes = {
  type: {
    control: { type: 'select' },
    defaultValue: 'email',
  },
  placeholder: {
    control: { type: 'text' },
    defaultValue: 'Email',
  },
  size: {
    control: { type: 'select' },
    defaultValue: 'large',
  },
};

export const Password = (args: DvtInputProps) => {
  const [text, setText] = useState<string>('');
  return (
    <div style={{ width: 404 }}>
      <DvtInput {...args} value={text} onChange={setText} />
    </div>
  );
};

Password.argTypes = {
  type: {
    control: { type: 'select' },
    defaultValue: 'password',
  },
  placeholder: {
    control: { type: 'text' },
    defaultValue: 'Password',
  },
  size: {
    control: { type: 'select' },
    defaultValue: 'large',
  },
};

export const Search = (args: DvtInputProps) => {
  const [text, setText] = useState<string>('');
  return (
    <div style={{ width: 200 }}>
      <DvtInput
        {...args}
        value={text}
        onChange={setText}
        handleSearchClick={() => {}}
      />
    </div>
  );
};

Search.argTypes = {
  type: {
    control: { type: 'select' },
    defaultValue: 'search',
  },
};

export const Form = (args: DvtInputProps) => {
  const [text, setText] = useState<string>('');
  return (
    <div style={{ width: 282 }}>
      <DvtInput
        {...args}
        value={text}
        onChange={setText}
        handleSearchClick={() => {}}
      />
    </div>
  );
};

Form.argTypes = {
  type: {
    control: { type: 'select' },
    defaultValue: 'form',
  },
  size: {
    control: { type: 'select' },
    defaultValue: 'small',
  },
  typeDesign: {
    control: { type: 'select' },
    defaultValue: 'form',
  },
};

export const ChartsForm = (args: DvtInputProps) => {
  const [text, setText] = useState<string>('');
  const [inputText, setInputText] = useState<string>('');
  return (
    <div style={{ display: 'flex', width: 500, gap: 15 }}>
      <DvtInput
        {...args}
        label="Y Axis Label"
        placeholder="min"
        value={text}
        onChange={setText}
        handleSearchClick={() => {}}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'flex-end',
        }}
      >
        <DvtInput
          {...args}
          value={inputText}
          onChange={setInputText}
          handleSearchClick={() => {}}
          placeholder="max"
        />
      </div>
    </div>
  );
};

ChartsForm.argTypes = {
  type: {
    control: { type: 'select' },
    defaultValue: 'text',
  },
  size: {
    control: { type: 'select' },
    defaultValue: 'small',
  },
  typeDesign: {
    control: { type: 'select' },
    defaultValue: 'chartsForm',
  },
};
