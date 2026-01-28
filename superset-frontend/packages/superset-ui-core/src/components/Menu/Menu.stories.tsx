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
  parameters: {
    docs: {
      description: {
        component:
          'Navigation menu component supporting horizontal, vertical, and inline modes. Based on Ant Design Menu with Superset styling.',
      },
    },
  },
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
  mode: 'horizontal',
  selectable: true,
};

InteractiveMenu.argTypes = {
  mode: {
    control: 'select',
    options: ['horizontal', 'vertical', 'inline'],
    description: 'Menu display mode: horizontal navbar, vertical sidebar, or inline collapsible.',
  },
  selectable: {
    control: 'boolean',
    description: 'Whether menu items can be selected.',
  },
  multiple: {
    control: 'boolean',
    description: 'Allow multiple items to be selected.',
  },
  inlineCollapsed: {
    control: 'boolean',
    description: 'Whether the inline menu is collapsed (only applies to inline mode).',
  },
};

InteractiveMenu.parameters = {
  docs: {
    staticProps: {
      items: [
        { label: 'Dashboards', key: 'dashboards' },
        { label: 'Charts', key: 'charts' },
        { label: 'Datasets', key: 'datasets' },
        { label: 'SQL Lab', key: 'sqllab' },
      ],
    },
    liveExample: `function Demo() {
  return (
    <Menu
      mode="horizontal"
      selectable
      items={[
        { label: 'Dashboards', key: 'dashboards' },
        { label: 'Charts', key: 'charts' },
        { label: 'Datasets', key: 'datasets' },
        { label: 'SQL Lab', key: 'sqllab' },
      ]}
    />
  );
}`,
    examples: [
      {
        title: 'Vertical Menu',
        code: `function VerticalMenu() {
  return (
    <Menu
      mode="vertical"
      style={{ width: 200 }}
      items={[
        { label: 'Dashboards', key: 'dashboards' },
        { label: 'Charts', key: 'charts' },
        { label: 'Datasets', key: 'datasets' },
        {
          label: 'Settings',
          key: 'settings',
          children: [
            { label: 'Profile', key: 'profile' },
            { label: 'Preferences', key: 'preferences' },
          ],
        },
      ]}
    />
  );
}`,
      },
      {
        title: 'Menu with Icons',
        code: `function MenuWithIcons() {
  return (
    <Menu
      mode="horizontal"
      items={[
        { label: <><Icons.DashboardOutlined /> Dashboards</>, key: 'dashboards' },
        { label: <><Icons.LineChartOutlined /> Charts</>, key: 'charts' },
        { label: <><Icons.DatabaseOutlined /> Datasets</>, key: 'datasets' },
        { label: <><Icons.ConsoleSqlOutlined /> SQL Lab</>, key: 'sqllab' },
      ]}
    />
  );
}`,
      },
    ],
  },
};
