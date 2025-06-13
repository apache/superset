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
import {
  Layout,
  Menu,
  Button,
  Card,
  Alert,
  Input,
  Table,
  Space,
} from '@superset-ui/core/components';
// eslint-disable-next-line import/no-extraneous-dependencies
import { Icons } from '@superset-ui/core/components/Icons';

const { Header, Content, Sider } = Layout;

export default {
  title: 'Example/ExampleApp',
};

export const KitchenSink = () => {
  const columns = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Age', dataIndex: 'age' },
    { title: 'Address', dataIndex: 'address' },
  ];

  const data = [
    { key: 1, name: 'John Brown', age: 32, address: 'New York' },
    { key: 2, name: 'Jim Green', age: 42, address: 'London' },
    { key: 3, name: 'Joe Black', age: 28, address: 'Sydney' },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ color: 'white', fontSize: 18 }}>My App</Header>
      <Layout>
        <Sider width={200}>
          <Menu
            mode="inline"
            defaultSelectedKeys={['1']}
            style={{ height: '100%' }}
            items={[
              { key: '1', icon: <Icons.UserOutlined />, label: 'Users' },
              { key: '2', icon: <Icons.BookOutlined />, label: 'Devices' },
              { key: '3', icon: <Icons.CheckCircleFilled />, label: 'Alerts' },
            ]}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Alert
                message="Welcome"
                description="You are logged in."
                type="info"
              />
              <Card title="Quick Actions">
                <Space>
                  <Button type="primary">Create</Button>
                  <Button>Settings</Button>
                  <Input placeholder="Search..." />
                </Space>
              </Card>
              <Card title="User Table">
                <Table columns={columns} dataSource={data} pagination={false} />
              </Card>
            </Space>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};
