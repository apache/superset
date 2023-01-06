import React, { useState } from 'react';
import { Layout, Menu } from 'antd';
import { SupersetTheme, useTheme } from '@superset-ui/core';
import {
  HomeOutlined,
  SearchOutlined,
  DatabaseOutlined,
  SettingOutlined,
  BellOutlined,
} from '@ant-design/icons';
import UploadCsv from 'src/views/components/Upload';
import HeaderPage from './pages/HeaderPage';
import ContentPage from './pages/ContentPage';
import ViewSearchPage from './pages/ViewSearchPage';
// import HeaderViewTablePage from './pages/HeaderViewTablePage';
// import ViewTablePage from './pages/ViewTablePage';

const { Header, Content, Sider } = Layout;

const DatamanageList = () => {
  const theme: SupersetTheme = useTheme();
  const [outLined, setoutLined] = useState('1');

  const onShowUploadUI = () => {
    setoutLined('3');
  };
  const handleOutLined = (ev: any) => {
    setoutLined(ev.key);
  };
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
          onClick={handleOutLined}
          // defaultSelectedKeys={[outLined]}
          defaultOpenKeys={['sub1']}
          mode="inline"
          style={{
            background: theme.colors.quotron.gray_white,
            height: '100%',
          }}
        >
          <Menu.Item
            key={1}
            className={`${outLined === '1' ? 'ant-menu-item-selected' : ''}`}
            icon={<HomeOutlined />}
          />
          <Menu.Item
            key={2}
            className={`${outLined === '2' ? 'ant-menu-item-selected' : ''}`}
            icon={<SearchOutlined />}
          />
          <Menu.Item
            key={3}
            className={`${outLined === '3' ? 'ant-menu-item-selected' : ''}`}
            icon={<DatabaseOutlined />}
          />
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
      {outLined === '2' && (
        <Layout>
          <ViewSearchPage />
        </Layout>
      )}
      {outLined === '3' && (
        <Layout>
          <UploadCsv />
        </Layout>
      )}
      {outLined === '1' && (
        <Layout>
          <Header
            style={{
              padding: '48px',
              background: theme.colors.quotron.white,
            }}
          >
            <HeaderPage onShowUploadUI={onShowUploadUI} />
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
          </Content>
        </Layout>
      )}
    </Layout>
  );
};
export default DatamanageList;
