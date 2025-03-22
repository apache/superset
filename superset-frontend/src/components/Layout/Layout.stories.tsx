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
import { Meta, StoryObj } from '@storybook/react';
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
} satisfies Meta<typeof Layout>;

type Story = StoryObj<typeof Layout>;

export const LayoutStory: Story = {
  args: {
    hasSider: true,
  },
  render: args => {
    const [collapsed, setCollapsed] = useState(false);

    return (
      <Layout style={{ minHeight: '100vh' }}>
        {args.hasSider && (
          <Sider
            collapsible
            collapsed={collapsed}
            onCollapse={setCollapsed}
            theme="dark"
            width="200"
            collapsedWidth="80"
            reverseArrow={false}
            breakpoint="md"
          >
            <div
              className="logo"
              style={{
                height: '32px',
                margin: '16px',
                background: '#ffffff30',
              }}
            />
            <Menu defaultSelectedKeys={['1']} mode="inline">
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
    );
  },
};
