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

export const InteractiveLayout: Story = {
  args: {
    hasSider: false,
  },
  argTypes: {
    hasSider: {
      control: 'boolean',
      description: 'Whether the layout contains a Sider sub-component.',
    },
  },
  render: ({
    className,
    hasSider,
    ...siderProps
  }: LayoutProps & SiderProps) => (
    <Layout
      className={className}
      hasSider={hasSider}
      style={{ minHeight: '400px' }}
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

InteractiveLayout.parameters = {
  docs: {
    staticProps: {
      style: { minHeight: 200 },
    },
    sampleChildren: [
      { component: 'Layout.Header', props: { children: 'Header', style: { background: '#001529', color: '#fff', padding: '0 24px', lineHeight: '64px' } } },
      { component: 'Layout.Content', props: { children: 'Content Area', style: { padding: '24px', background: '#fff', flex: 1 } } },
      { component: 'Layout.Footer', props: { children: 'Footer', style: { textAlign: 'center', background: '#f5f5f5', padding: '12px' } } },
    ],
    description: {
      story:
        'Layout component with Header, Footer, Sider, and Content areas.',
    },
    liveExample: `function Demo() {
  return (
    <Layout style={{ minHeight: '300px' }}>
      <Layout.Sider theme="dark" width={200}>
        <div style={{ color: '#fff', padding: '16px' }}>Sidebar</div>
      </Layout.Sider>
      <Layout>
        <Layout.Header style={{ background: '#fff', padding: '0 16px' }}>
          Header
        </Layout.Header>
        <Layout.Content style={{ margin: '16px', padding: '24px', background: '#fff' }}>
          Content
        </Layout.Content>
        <Layout.Footer style={{ textAlign: 'center' }}>
          Footer
        </Layout.Footer>
      </Layout>
    </Layout>
  );
}`,
    examples: [
      {
        title: 'Content Only',
        code: `function ContentOnly() {
  return (
    <Layout>
      <Layout.Header style={{ background: '#001529', color: '#fff', padding: '0 24px', lineHeight: '64px' }}>
        Application Header
      </Layout.Header>
      <Layout.Content style={{ padding: '24px', minHeight: '200px', background: '#fff' }}>
        Main content area without a sidebar
      </Layout.Content>
      <Layout.Footer style={{ textAlign: 'center', background: '#f5f5f5' }}>
        Footer Content
      </Layout.Footer>
    </Layout>
  );
}`,
      },
      {
        title: 'Right Sidebar',
        code: `function RightSidebar() {
  return (
    <Layout style={{ minHeight: '300px' }}>
      <Layout>
        <Layout.Header style={{ background: '#fff', padding: '0 24px' }}>
          Header
        </Layout.Header>
        <Layout.Content style={{ padding: '24px', background: '#fff' }}>
          Content with right sidebar
        </Layout.Content>
      </Layout>
      <Layout.Sider theme="light" width={200} style={{ background: '#fafafa' }}>
        <div style={{ padding: '16px' }}>Right Sidebar</div>
      </Layout.Sider>
    </Layout>
  );
}`,
      },
    ],
  },
};

// Keep original for backwards compatibility
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
