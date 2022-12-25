import React from 'react';
import { Layout, Menu, Button } from 'antd';
import {
  HomeOutlined,
  SearchOutlined,
  DatabaseOutlined,
  SettingOutlined,
  BellOutlined
} from '@ant-design/icons';
import HeaderPage from './pages/HeaderPage';
import ContentPage from './pages/ContentPage';
import HeaderViewTablePage from './pages/HeaderViewTablePage';
import ViewTablePage from './pages/ViewTablePage';

const { Header, Content, Sider } = Layout;

const App = () => {
  return (
    <Layout >
      <Sider
        collapsible 
        collapsed
        trigger={null}
        theme="light"
        style={{
          background: "#f5f5f5"
        }}
      >
        <Menu
          defaultSelectedKeys={['1']}
          defaultOpenKeys={['sub1']}
          mode="inline"
          style={{
            background: "#f5f5f5",
            height: "100%"
          }}
        >
          <Menu.Item
            key={1}
            icon={<HomeOutlined />}
          />
          <Menu.Item
            key={2}
            icon={<SearchOutlined />}
          />
          <Menu.Item
            key={3}
            icon={<DatabaseOutlined />}
          />
          <Menu.Item
            key={4}
            icon={<BellOutlined />}
            style={{position: "absolute", bottom: 70}}
          />
          <Menu.Item
            key={5}
            icon={<SettingOutlined />}
            style={{position: "absolute", bottom: 20}}
          />
        </Menu>
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '48px',
            background: "#fff",
          }}
        >
          <HeaderPage />
          {/* <HeaderViewTablePage /> */}
        </Header>
        <Content
          style={{
            minHeight: '90vh',
            background: "#fff",
            padding: '48px'
          }}
        >
          <ContentPage />
          {/* <ViewTablePage /> */}
        </Content>
      </Layout>
    </Layout>
  );
};
export default App;