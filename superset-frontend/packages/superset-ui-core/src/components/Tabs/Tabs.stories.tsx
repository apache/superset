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
};

export const InteractiveTabs = (args: TabsProps) => <Tabs {...args} />;

InteractiveTabs.args = {
  defaultActiveKey: '1',
  animated: true,
  centered: false,
  allowOverflow: false,
  tabPosition: 'top',
  size: 'middle',
  tabBarGutter: 8,
  items: [
    {
      key: '1',
      label: 'Tab 1',
      children: 'Content of Tab Pane 1',
    },
    {
      key: '2',
      label: 'Tab 2',
      children: 'Content of Tab Pane 2',
    },
    {
      key: '3',
      label: 'Tab 3',
      children: 'Content of Tab Pane 3',
    },
  ],
};

InteractiveTabs.argTypes = {
  onChange: { action: 'onChange' },
  type: {
    defaultValue: 'line',
    control: {
      type: 'inline-radio',
    },
    options: ['line', 'card', 'editable-card'],
  },
  tabPosition: {
    control: {
      type: 'inline-radio',
    },
    options: ['top', 'bottom', 'left', 'right'],
  },
  size: {
    control: {
      type: 'inline-radio',
    },
    options: ['small', 'middle', 'large'],
  },
  tabBarGutter: {
    control: {
      type: 'number',
    },
  },
};
