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
  const [selectedValue, setSelectedValue] = useState<string>('');

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
