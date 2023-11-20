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
};

export const Search = (args: DvtInputProps) => {
  const [text, setText] = useState<string>('');
  return (
    <div style={{ width: 200 }}>
      <DvtInput {...args} value={text} onChange={setText} />
    </div>
  );
};

Search.argTypes = {
  type: {
    control: { type: 'select' },
    defaultValue: 'search',
  },
};
