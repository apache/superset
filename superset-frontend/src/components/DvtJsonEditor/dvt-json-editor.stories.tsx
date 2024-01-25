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
import { supersetTheme } from '@superset-ui/core';
import DvtJsonEditor, { DvtJsonEditorProps } from '.';

export default {
  title: 'Dvt-Components/DvtJsonEditor',
  component: DvtJsonEditor,
};

export const Default = (args: DvtJsonEditorProps) => {
  const [text, setText] = useState<string>('');

  return (
    <div
      style={{
        padding: 20,
        height: '88vh',
        width: '100%',
        background: supersetTheme.colors.dvt.grayscale.light2,
      }}
    >
      <div style={{ width: 226 }}>
        <DvtJsonEditor {...args} value={text} onChange={setText} />
      </div>
    </div>
  );
};

Default.argTypes = {
  label: {
    control: { type: 'text' },
    defaultValue: 'SQL QUERY',
  },
  height: {
    control: { type: 'text' },
    defaultValue: '169px',
  },
  placeholder: {
    control: { type: 'text' },
    defaultValue: '',
  },
  name: {
    control: { type: 'text' },
    defaultValue: '',
  },
};
