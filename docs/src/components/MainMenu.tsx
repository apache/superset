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
import React from 'react';
import {
  Button, Drawer, Layout, Menu,
} from 'antd';
import { Link } from 'gatsby';
import { MenuOutlined } from '@ant-design/icons';
import { css } from '@emotion/core';
import { getCurrentPath, mq } from '../utils';
import logoSvg from '../images/superset-logo-horiz.svg';

const menuResponsiveIndex = 1;

const headerStyle = css`
  background-color: rgb(255,255,255, 0.9);
  padding-left: 0px;
  padding-right: 0px;
  position: fixed;
  /top: 0;
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
const logoStyle = css`
  float: left;
  margin-top: 5px;
  height: 50px;
`;

const getStartedButtonStyle = css`
  ${[mq[menuResponsiveIndex]]} {
    display: none;
  }
`;
const hamStyle = css`
  display: none;
  float: right;
  padding-right: 16px;
  ${[mq[menuResponsiveIndex]]} {
    display: inline-block;
  }
`;
const leftMenuStyle = css`
  float: left;
  ${[mq[menuResponsiveIndex]]} {
    display: none;
  }
`;
const rightMenuStyle = css`
  float: right;
  ${[mq[menuResponsiveIndex]]} {
    display: none;
  }
`;

const LeftMenuItems = ({ mode }) => (
  <Menu mode={mode} selectedKeys={getCurrentPath()}>
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
);
const RightMenuItems = ({ mode }) => (
  <Menu mode={mode} selectedKeys={getCurrentPath()}>
    <Menu.Item>
      <Link to="/docs/intro">
        <span css={getStartedButtonStyle}>
          <Button type="primary" size="medium">
            Get Started
          </Button>
        </span>
      </Link>
    </Menu.Item>
  </Menu>
);

export default class MainMenu extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
	  visible: false,
    };
    this.toggleDrawer = this.toggleDrawer.bind(this);
    this.onClose = this.onClose.bind(this);
  }

  toggleDrawer() {
    this.setState({
      visible: !this.state.visible,
    });
  }

  onClose() {
    this.setState({
      visible: false,
    });
  }

  render() {
    return (
      <Layout.Header css={headerStyle}>
        <Link to="/">
          <img height="50" css={logoStyle} src={logoSvg} alt="logo" />
        </Link>
        <div css={leftMenuStyle}>
          <LeftMenuItems mode="horizontal" />
        </div>
        <div css={rightMenuStyle}>
          <RightMenuItems mode="horizontal" />
        </div>
        <span css={hamStyle}>
          <MenuOutlined onClick={this.toggleDrawer} />
        </span>
        <Drawer
          placement="right"
          closable={false}
          onClose={this.onClose}
          visible={this.state.visible}
        >
          <LeftMenuItems mode="vertical" />
        </Drawer>
      </Layout.Header>
    );
  }
}
