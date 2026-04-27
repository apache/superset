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
import Tabs, { TabsProps } from '.';

export default {
  title: 'Components/Tabs',
  component: Tabs,
  parameters: {
    docs: {
      description: {
        component:
          'A tabs component for switching between different views or content sections. ' +
          'Supports multiple tab styles, positions, and sizes.',
      },
    },
  },
};

// Demo tab items (kept separate from args to avoid parser issues)
const demoItems = [
  { key: '1', label: 'Tab 1', children: 'Content of Tab Pane 1' },
  { key: '2', label: 'Tab 2', children: 'Content of Tab Pane 2' },
  { key: '3', label: 'Tab 3', children: 'Content of Tab Pane 3' },
];

export const InteractiveTabs = (args: TabsProps) => (
  <Tabs {...args} items={demoItems} />
);

InteractiveTabs.args = {
  defaultActiveKey: '1',
  type: 'line',
  tabPosition: 'top',
  size: 'middle',
  animated: true,
  centered: false,
  tabBarGutter: 8,
};

InteractiveTabs.argTypes = {
  onChange: { action: 'onChange' },
  type: {
    description: 'The style of tabs. Options: line, card, editable-card.',
    control: { type: 'inline-radio' },
    options: ['line', 'card', 'editable-card'],
  },
  tabPosition: {
    description: 'Position of tabs. Options: top, bottom, left, right.',
    control: { type: 'inline-radio' },
    options: ['top', 'bottom', 'left', 'right'],
  },
  size: {
    description: 'Size of the tabs.',
    control: { type: 'inline-radio' },
    options: ['small', 'middle', 'large'],
  },
  animated: {
    description: 'Whether to animate tab transitions.',
    control: { type: 'boolean' },
  },
  centered: {
    description: 'Whether to center the tabs.',
    control: { type: 'boolean' },
  },
  tabBarGutter: {
    description: 'The gap between tabs.',
    control: { type: 'number' },
  },
};

InteractiveTabs.parameters = {
  docs: {
    staticProps: {
      items: [
        { key: '1', label: 'Tab 1', children: 'Content of Tab Pane 1' },
        { key: '2', label: 'Tab 2', children: 'Content of Tab Pane 2' },
        { key: '3', label: 'Tab 3', children: 'Content of Tab Pane 3' },
      ],
    },
    liveExample: `function Demo() {
  return (
    <Tabs
      defaultActiveKey="1"
      items={[
        { key: '1', label: 'Tab 1', children: 'Content of Tab Pane 1' },
        { key: '2', label: 'Tab 2', children: 'Content of Tab Pane 2' },
        { key: '3', label: 'Tab 3', children: 'Content of Tab Pane 3' },
      ]}
    />
  );
}`,
    examples: [
      {
        title: 'Card Style',
        code: `function CardTabs() {
  return (
    <Tabs
      type="card"
      defaultActiveKey="1"
      items={[
        { key: '1', label: 'Dashboards', children: 'View and manage your dashboards.' },
        { key: '2', label: 'Charts', children: 'Browse all saved charts.' },
        { key: '3', label: 'Datasets', children: 'Explore available datasets.' },
      ]}
    />
  );
}`,
      },
      {
        title: 'Tab Positions',
        code: `function TabPositions() {
  const items = [
    { key: '1', label: 'Tab 1', children: 'Content 1' },
    { key: '2', label: 'Tab 2', children: 'Content 2' },
    { key: '3', label: 'Tab 3', children: 'Content 3' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {['top', 'bottom', 'left', 'right'].map(pos => (
        <div key={pos}>
          <h4>{pos}</h4>
          <Tabs tabPosition={pos} defaultActiveKey="1" items={items} />
        </div>
      ))}
    </div>
  );
}`,
      },
      {
        title: 'With Icons',
        code: `function IconTabs() {
  return (
    <Tabs
      defaultActiveKey="1"
      items={[
        { key: '1', label: <><Icons.DashboardOutlined /> Dashboards</>, children: 'Dashboard content here.' },
        { key: '2', label: <><Icons.LineChartOutlined /> Charts</>, children: 'Chart content here.' },
        { key: '3', label: <><Icons.DatabaseOutlined /> Datasets</>, children: 'Dataset content here.' },
        { key: '4', label: <><Icons.ConsoleSqlOutlined /> SQL Lab</>, children: 'SQL Lab content here.' },
      ]}
    />
  );
}`,
      },
    ],
  },
};
