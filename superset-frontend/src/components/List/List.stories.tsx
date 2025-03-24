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

import { List, ListProps } from '.';

export default {
  title: 'List',
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
  itemLayout: 'horizontal',
  size: 'default',
  loading: false,
};

InteractiveList.argTypes = {
  bordered: {
    control: { type: 'boolean' },
  },
  split: {
    control: { type: 'boolean' },
  },
  loading: {
    control: { type: 'boolean' },
  },
  itemLayout: {
    control: { type: 'select' },
    options: ['horizontal', 'vertical'],
  },
  size: {
    control: { type: 'select' },
    options: ['default', 'small', 'large'],
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
