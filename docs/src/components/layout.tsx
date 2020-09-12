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
import React, { useState } from 'react';
import { Link } from 'gatsby';
import {
  Layout, Menu, Button, Drawer,
} from 'antd';
import { css } from '@emotion/core';
import { MenuOutlined } from '@ant-design/icons';

import logoSvg from '../images/superset-logo-horiz.svg';
import Footer from './footer';
import SEO from './seo';
import AppMenu from './menu';

import { getCurrentPath } from '../utils';
import 'antd/dist/antd.css';
import './layout.scss';

const { Header, Sider } = Layout;

const leftPaneWidth = 350;
const breakpoints = [576, 768, 992, 1200];

const mq = breakpoints.map((bp) => `@media (max-width: ${bp}px)`);

const layoutStyles = css`
  font-family: Inter;
  .ant-layout {
    background-color: white !important;
  }
  Button {
    background: #20a7c9;
    border-color: #20a7c9;
    border-radius: 4px;
  }
`;

const headerStyle = css`
  background-color: #fff;
  position: fixed;
  top: 0;
  width: 100%;
  box-shadow: 0 2px 6px 0 rgba(0, 0, 0, 0.12);
  z-index: 1;
  .ant-menu {
    background: transparent;
  }
  .ant-menu-horizontal {
    border-bottom: none;
  }
`;

const getStartedButtonStyle = css`
  position: absolute;
  top: 0;
  right: 16px;
`;

const centerLayoutStyle = css`
  padding: 25px;
  min-height: 60vw;
  overflow: auto;
  padding-right: 250px;
  .menu {
    display: none;
    ${[mq[2]]} {
      display: block;
    }
    padding: 25px;
  }
`;

const sidebarStyle = css`
  background-color: #fff;
  position: fixed;
  top: 64px;
  bottom: 0px;
  left: 0px;
  border-right: 1px solid #bfbfbf;
`;

const contentStyle = css`
  margin-top: 3px;
  background-color: white;
  h2 {
    font-size: 30px;
    font-weight: bold;
  }
  h3 {
    font-size: 20px;
    font-weight: bold;
  }
  img {
    max-width: 800px;
    margin-bottom: 15px;
  }
  blockquote {
    color: rgb(132, 146, 166);
    padding: 10px 30px;
    margin: 30px 0px;
    border-radius: 3px;
    border-left: 4px solid rgb(56, 211, 236);
    background: rgb(239, 242, 247);
  }
  pre {
    border: solid #00000033 1px;
    padding: 5px;
    background-color: #82ef8217;
    border-radius: 3px;
    max-width: 1000px;
  }
  p {
    font-size: 16px;
  }
  ul {
    font-size: 16px;
  }
`;

const contentLayoutDocsStyle = css`
  position: fixed;
  top: 64px;
  left: ${leftPaneWidth}px;
  right: 0px;
  bottom: 0px;
  overflow: visible;
  ${[mq[2]]} {
    top: 64px;
    left: 0;
  }
  aside {
    ${[mq[2]]} {
      display: none;
    }
    overflow: auto;
  }
`;

const logoStyle = css`
  float: left;
  margin-left: -50px;
  margin-top: 5px;
  heigh: 30px;
`;
interface Props {
  children: React.ReactNode;
}

const AppLayout = ({ children }: Props) => {
  const [showDrawer, setDrawer] = useState(false);
  const isOnDocsPage = getCurrentPath().indexOf('docs') > -1;
  return (
    <Layout css={layoutStyles}>
      <SEO title="Welcome" />
      <Header css={headerStyle}>
        <Link to="/">
          <img height="50" css={logoStyle} src={logoSvg} alt="logo" />
        </Link>
        <Menu mode="horizontal" selectedKeys={getCurrentPath()}>
          <Menu.Item key="docsintro">
            <Link to="/docs/intro">Documentation</Link>
          </Menu.Item>
          <Menu.Item key="community">
            <Link to="/community">Community</Link>
          </Menu.Item>
          <Menu.Item key="resources">
            <Link to="/resources"> Resources</Link>
          </Menu.Item>
        </Menu>
        <div css={getStartedButtonStyle}>
          <Link to="/docs/intro">
            <Button type="primary" size="medium">
              Get Started
            </Button>
          </Link>
        </div>
      </Header>
      {isOnDocsPage ? (
        <>
          <Drawer
            placement="left"
            closable={false}
            onClose={() => setDrawer(false)}
            visible={showDrawer}
            getContainer={false}
            style={{ position: 'absolute' }}
          >
            <AppMenu />
          </Drawer>
          <Layout css={contentLayoutDocsStyle}>
            {isOnDocsPage && (
              <Sider width={leftPaneWidth} css={sidebarStyle}>
                <AppMenu />
              </Sider>
            )}
            <Layout css={contentStyle}>
              <div css={centerLayoutStyle}>
                <MenuOutlined
                  onClick={() => setDrawer(true)}
                  className="menu"
                />
                {children}
              </div>
              <Footer />
            </Layout>
          </Layout>
        </>
      ) : (
        <Layout>
          {children}
          <Footer />
        </Layout>
      )}
    </Layout>
  );
};

export default AppLayout;
