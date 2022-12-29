import React from 'react';
import { Layout, Menu } from 'antd';
import { SupersetTheme, useTheme } from '@superset-ui/core';
import {
  HomeOutlined,
  SearchOutlined,
  DatabaseOutlined,
  SettingOutlined,
  BellOutlined,
} from '@ant-design/icons';
import HeaderPage from './pages/HeaderPage';
import ContentPage from './pages/ContentPage';
// import HeaderViewTablePage from './pages/HeaderViewTablePage';
// import ViewTablePage from './pages/ViewTablePage';

const { Header, Content, Sider } = Layout;

const DatamanageList = () => {
  const theme: SupersetTheme = useTheme();
  return (
    <Layout>
      <Sider
        collapsible
        collapsed
        trigger={null}
        theme="light"
        style={{
          background: theme.colors.quotron.gray_white,
        }}
      >
        <Menu
          defaultSelectedKeys={['1']}
          defaultOpenKeys={['sub1']}
          mode="inline"
          style={{
            background: theme.colors.quotron.gray_white,
            height: '100%',
          }}
        >
          <Menu.Item key={1} icon={<HomeOutlined />} />
          <Menu.Item key={2} icon={<SearchOutlined />} />
          <Menu.Item key={3} icon={<DatabaseOutlined />} />
          <Menu.Item
            key={4}
            icon={<BellOutlined />}
            style={{ position: 'absolute', bottom: 70 }}
          />
          <Menu.Item
            key={5}
            icon={<SettingOutlined />}
            style={{ position: 'absolute', bottom: 20 }}
          />
        </Menu>
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '48px',
            background: theme.colors.quotron.white,
          }}
        >
          <HeaderPage />
          {/* <HeaderViewTablePage /> */}
        </Header>
        <Content
          style={{
            minHeight: '90vh',
            background: theme.colors.quotron.white,
            padding: '48px',
          }}
        >
          <ContentPage />
          {/* <ViewTablePage /> */}
        </Content>
      </Layout>
    </Layout>
  );
};
export default DatamanageList;
