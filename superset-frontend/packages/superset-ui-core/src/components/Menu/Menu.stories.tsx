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
import { Menu, MainNav } from '.';

export default {
  title: 'Components/Menu',
  component: Menu as React.FC,
};

export const MainNavigation = (args: any) => (
  <MainNav
    mode="horizontal"
    items={[
      { key: 'dashboards', label: 'Dashboards', href: '/' },
      { key: 'charts', label: 'Charts', href: '/' },
      { key: 'datasets', label: 'Datasets', href: '/' },
    ]}
    {...args}
  />
);

export const InteractiveMenu = (args: any) => (
  <Menu
    items={[
      { label: 'Dashboards', key: '1' },
      { label: 'Charts', key: '2' },
      { label: 'Datasets', key: '3' },
    ]}
    {...args}
  />
);

InteractiveMenu.args = {
  defaultSelectedKeys: ['1'],
  inlineCollapsed: false,
  mode: 'horizontal',
  multiple: false,
  selectable: true,
};

InteractiveMenu.argTypes = {
  mode: {
    control: {
      type: 'select',
    },
    options: ['horizontal', 'vertical', 'inline'],
  },
};
