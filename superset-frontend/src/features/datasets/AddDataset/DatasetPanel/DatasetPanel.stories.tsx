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

import { StoryFn, Meta } from '@storybook/react';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import DatasetPanel from './DatasetPanel';
import { exampleColumns } from './fixtures';

export default {
  title: 'Superset App/views/CRUD/data/dataset/DatasetPanel',
  component: DatasetPanel,
} as Meta<typeof DatasetPanel>;

export const Basic: StoryFn<typeof DatasetPanel> = args => (
  <ThemeProvider theme={supersetTheme}>
    <div style={{ height: '350px' }}>
      <DatasetPanel {...args} />
    </div>
  </ThemeProvider>
);

Basic.args = {
  tableName: 'example_table',
  loading: false,
  hasError: false,
  columnList: exampleColumns,
};
