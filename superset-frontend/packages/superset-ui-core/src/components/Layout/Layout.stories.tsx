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
import { Meta, StoryObj } from '@storybook/react';
import { Icons } from '@superset-ui/core/components/Icons';
import { Menu } from '../Menu';
import type { LayoutProps, SiderProps } from './types';
import { Layout } from '.';

const { Header, Footer, Sider, Content } = Layout;

export default {
  title: 'Design System/Components/Layout',
  component: Layout,
  subcomponents: { Header, Footer, Sider, Content },
  argTypes: {
    // Layout properties
    className: {
      control: false,
      table: {
        category: 'Layout',
        type: { summary: 'string' },
        defaultValue: { summary: 'undefined' },
      },
    },
    hasSider: {
      control: 'boolean',
      description: 'Include a sider',
      table: {
        category: 'Layout',
        type: { summary: 'boolean' },
      },
    },
    // Layout.Sider properties
    breakpoint: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'],
      description: 'Responsive breakpoint for the Sider',
      table: {
        category: 'Sider',
        type: { summary: 'text' },
      },
    },
    collapsible: {
      control: 'boolean',
      description: 'Whether the Sider can be collapsed',
      table: {
        category: 'Sider',
        type: { summary: 'boolean' },
      },
    },
    collapsed: {
      control: 'boolean',
      description: 'To set the current status of the Sider',
      table: {
        category: 'Sider',
        type: { summary: 'boolean' },
      },
    },
    collapsedWith: {
      control: false,
      description:
        'Width of the collapsed sidebar, by setting to 0 a special trigger will appear',
      table: {
        category: 'Sider',
        type: { summary: 'number' },
        defaultValue: 80,
      },
    },
    reverseArrow: {
      control: 'boolean',
      description: 'Whether the arrow icon is reversed',
      table: {
        category: 'Sider',
        type: { summary: 'boolean' },
      },
    },
    theme: {
      control: 'select',
      options: ['light', 'dark'],
      description: 'Theme for the Sider',
      table: {
        category: 'Sider',
        type: { summary: 'string' },
        defaultValue: { summary: 'dark' },
      },
    },
    width: {
      control: 'number',
      description: 'Width of the Sider',
      table: {
        category: 'Sider',
        type: { summary: 'number' },
        defaultValue: { summary: '200' },
      },
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
} as Meta<typeof Layout & typeof Sider>;

type Story = StoryObj<typeof Layout>;

export const LayoutStory: Story = {
  render: ({
    className,
    hasSider,
    ...siderProps
  }: LayoutProps & SiderProps) => (
    <Layout
      className={className}
      hasSider={hasSider}
      style={{ minHeight: '100vh' }}
    >
      {hasSider && (
        <Sider {...siderProps}>
          <div
            className="logo"
            style={{
              height: '32px',
              margin: '16px',
              background: '#ffffff30',
            }}
          />
          <Menu defaultSelectedKeys={['1']} mode="inline">
            <Menu.Item key="1" icon={<Icons.MenuUnfoldOutlined />}>
              Option 1
            </Menu.Item>
            <Menu.Item key="2" icon={<Icons.MenuFoldOutlined />}>
              Option 2
            </Menu.Item>
          </Menu>
        </Sider>
      )}
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 16px',
            textAlign: 'center',
          }}
        >
          Header
        </Header>
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
        <Footer style={{ textAlign: 'center' }}>
          Ant Design Layout Footer
        </Footer>
      </Layout>
    </Layout>
  ),
};
