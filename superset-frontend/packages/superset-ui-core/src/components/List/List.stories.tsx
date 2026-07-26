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

import { List } from '.';
import type { ListProps } from './types';

export default {
  title: 'Components/List',
  component: List,
};

const dataSource = ['Item 1', 'Item 2', 'Item 3'];

export const InteractiveList = (args: ListProps<any>) => (
  <List
    {...args}
    dataSource={dataSource}
    renderItem={item => <List.Item>{item}</List.Item>}
  />
);

InteractiveList.args = {
  bordered: false,
  split: true,
  size: 'default',
  loading: false,
};

InteractiveList.argTypes = {
  bordered: {
    control: { type: 'boolean' },
    description: 'Whether to show a border around the list.',
  },
  split: {
    control: { type: 'boolean' },
    description: 'Whether to show a divider between items.',
  },
  loading: {
    control: { type: 'boolean' },
    description: 'Whether to show a loading indicator.',
  },
  size: {
    control: { type: 'select' },
    options: ['default', 'small', 'large'],
    description: 'Size of the list.',
  },
};

InteractiveList.parameters = {
  docs: {
    description: {
      story:
        'A list component for displaying rows of data. Requires dataSource array and renderItem function.',
    },
    staticProps: {
      dataSource: ['Dashboard Analytics', 'User Management', 'Data Sources'],
    },
    liveExample: `function Demo() {
  const data = ['Dashboard Analytics', 'User Management', 'Data Sources'];
  return (
    <List
      bordered
      dataSource={data}
      renderItem={(item) => <List.Item>{item}</List.Item>}
    />
  );
}`,
  },
};

export const InteractiveListWithPagination = (args: ListProps<any>) => (
  <List
    {...args}
    dataSource={dataSource}
    renderItem={item => <List.Item>{item}</List.Item>}
    pagination={{ pageSize: 2 }}
  />
);

InteractiveListWithPagination.args = {
  ...InteractiveList.args,
};

InteractiveListWithPagination.argTypes = {
  ...InteractiveList.argTypes,
};
