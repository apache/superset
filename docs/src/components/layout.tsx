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
import {
  Layout, Drawer,
} from 'antd';
import { css } from '@emotion/core';
import { MenuOutlined } from '@ant-design/icons';

import Footer from './footer';
import SEO from './seo';
import DoczMenu from './DoczMenu';

import { getCurrentPath, mq } from '../utils';
import MainMenu from './MainMenu';
import 'antd/dist/antd.css';
import './layout.scss';

const { Sider } = Layout;

const leftPaneWidth = 350;

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

const centerLayoutStyle = css`
  padding: 25px;
  min-height: 60vw;
  overflow: auto;
  padding-right: 250px;
  ${[mq[3]]} {
    padding-right: 25px;
  }
  .doc-hamburger {
    display: none;
    ${[mq[2]]} {
      display: block;
    }
    text-align: left;
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
    padding: 5px 10px;
    background-color: #82ef8217;
    border-radius: 3px;
    max-width: 800px;
    width: 100%;
    overflow: auto;
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

interface Props {
  children: React.ReactNode;
}

const AppLayout = ({ children }: Props) => {
  const [showDrawer, setDrawer] = useState(false);
  const isOnDocsPage = getCurrentPath().indexOf('docs') > -1;
  return (
    <Layout css={layoutStyles}>
      <SEO title="Welcome" />
      <MainMenu />
      {isOnDocsPage ? (
        <>
          <Drawer
            title="Documentation"
            placement="left"
            closable={false}
            onClose={() => setDrawer(false)}
            visible={showDrawer}
            getContainer={false}
            style={{ position: 'absolute' }}
          >
            <DoczMenu />
          </Drawer>
          <Layout css={contentLayoutDocsStyle}>
            <Sider width={leftPaneWidth} css={sidebarStyle}>
              <DoczMenu />
            </Sider>
            <Layout css={contentStyle}>
              <div css={centerLayoutStyle}>
                <h1 className="doc-hamburger" onClick={() => setDrawer(true)}>
                  <MenuOutlined
                    className="menu"
                  />
                  {' '}
                  Documentation
                </h1>
                {children}
              </div>
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
