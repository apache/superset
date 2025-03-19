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
import { useState } from 'react';
import { Meta, StoryFn } from '@storybook/react';
import Layout from 'src/components/Layout';
import { Menu } from 'src/components/Menu';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';

const { Header, Footer, Sider, Content } = Layout;

export default {
  title: 'Components/Layout',
  component: Layout,
  subcomponents: { Header, Footer, Sider, Content },
  argTypes: {
    hasSider: {
      control: 'boolean',
      description: 'Include a sider',
      defaultValue: false,
    },
    // Layout.Sider props
    breakpoint: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'],
      description: 'Breakpoints of the responsive layout',
    },
    collapsed: {
      control: 'boolean',
      description: 'Set the current collapsed status',
      defaultValue: false,
    },
    collapsedWidth: {
      control: 'number',
      description: 'Width of collapsed sidebar',
      defaultValue: 80,
    },
    collapsible: {
      control: 'boolean',
      description: 'Whether the sidebar can be collapsed',
      defaultValue: false,
    },
    defaultCollapsed: {
      control: 'boolean',
      description: 'Set the initial collapsed status',
      defaultValue: false,
    },
    reverseArrow: {
      control: 'boolean',
      description: 'Reverse the direction of the collapse arrow',
      defaultValue: false,
    },
    theme: {
      control: 'select',
      options: ['light', 'dark'],
      description: 'Sidebar theme',
      defaultValue: 'dark',
    },
    width: {
      control: 'number',
      description: 'Width of the sidebar',
      defaultValue: 200,
    },
    headerVisible: {
      control: 'boolean',
      description: 'Show Header',
      defaultValue: true,
    },
    footerVisible: {
      control: 'boolean',
      description: 'Show Footer',
      defaultValue: true,
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Ant Design Layout component with configurable Sider, Header, Footer, and Content.',
      },
    },
  },
} as Meta;

export const LayoutStory: StoryFn = args => {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <Layout style={{ minHeight: '100vh' }}>
      {args.hasSider && (
        <Sider
          collapsible={args.collapsible}
          collapsed={collapsed}
          onCollapse={value => setCollapsed(value)}
          theme={args.theme}
          width={args.width}
          collapsedWidth={args.collapsedWidth}
        >
          <div
            className="logo"
            style={{ height: '32px', margin: '16px', background: '#ffffff30' }}
          />
          <Menu theme={args.theme} defaultSelectedKeys={['1']} mode="inline">
            <Menu.Item key="1" icon={<MenuUnfoldOutlined />}>
              Option 1
            </Menu.Item>
            <Menu.Item key="2" icon={<MenuFoldOutlined />}>
              Option 2
            </Menu.Item>
          </Menu>
        </Sider>
      )}
      <Layout>
        {args.headerVisible && (
          <Header
            style={{
              background: '#fff',
              padding: '0 16px',
              textAlign: 'center',
            }}
          >
            Header
          </Header>
        )}
        <Content
          style={{
            margin: '16px',
            padding: '24px',
            background: '#fff',
            textAlign: 'center',
          }}
        >
          Content Area
        </Content>
        {args.footerVisible && (
          <Footer style={{ textAlign: 'center' }}>
            Ant Design Layout Footer
          </Footer>
        )}
      </Layout>
    </Layout>
  );
};

LayoutStory.args = {
  hasSider: true,
  theme: 'dark',
  collapsible: true,
  collapsed: false,
  defaultCollapsed: false,
  collapsedWidth: 80,
  width: 200,
  reverseArrow: false,
  breakpoint: 'md',
  headerVisible: true,
  footerVisible: true,
};
