import React, { useState } from 'react';
import DvtSelect, { DvtSelectProps } from '.';

export default {
  title: 'Dvt-Components/DvtSelect',
  component: DvtSelect,
};

export const Default = (args: DvtSelectProps) => {
  const [selectedValue, setSelectedValue] = useState<string>(args.placeholder);

  return (
    <DvtSelect
      {...args}
      selectedValue={selectedValue}
      setSelectedValue={setSelectedValue}
    />
  );
};

Default.args = {
  label: 'State',
  data: [
    { value: 'failed', label: 'Failed' },
    { value: 'success', label: 'Success' },
  ],
  placeholder: 'Select or type a value',
};

export const Example = (args: DvtSelectProps) => {
  const [selectedValue, setSelectedValue] = useState<string>(args.placeholder);

  return (
    <DvtSelect
      {...args}
      selectedValue={selectedValue}
      setSelectedValue={setSelectedValue}
    />
  );
};

Example.args = {
  label: 'Database',
  data: [
    { value: 'mssql', label: 'MsSQL' },
    { value: 'mysql', label: 'MySQL' },
    { value: 'postgresql', label: 'PostgreSQL' },
  ],
  placeholder: 'Select or type a value',
};
