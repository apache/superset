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
import { Drawer, Layout, Menu } from 'antd';
import { Link } from 'gatsby';
import { MenuOutlined, GithubOutlined } from '@ant-design/icons';
import { css } from '@emotion/core';
import { getCurrentPath, mq } from '../utils';
import logoSvg from '../images/superset-logo-horiz.svg';

const menuResponsiveIndex = 1;

const headerStyle = css`
  background-color: rgb(255,255,255, 0.9);
  padding-left: 0px;
  padding-right: 0px;
  position: fixed;
  top: 0;
  width: 100%;
  box-shadow: 0 2px 6px 0 rgba(0, 0, 0, 0.12);
  z-index: 1;
  .ant-menu {
    background: transparent;
  }
  .menu-icon {
    vertical-align: middle;
    font-size: 24px;
    padding-left: 0px;
    padding-right: 0px;
  }
  .ant-menu-horizontal {
    border-bottom: none;
  }
  .menu-sm {
    display: none;
  }
  ${[mq[menuResponsiveIndex]]} {
    .menu-sm {
      display: block;
    }
    .menu-lg {
      display: none;
    }
  }
`;
const logoStyle = css`
  float: left;
  margin-top: 6px;
  height: 50px;
`;

interface menuProps {
  mode: string;
}

const MenuItems = ({ mode, toggleDrawer }: menuProps) => {
  let leftStyle = { float: 'left' };
  let rightStyle = { float: 'right' };
  if (mode === 'vertical') {
    leftStyle = null;
    rightStyle = null;
  }
  return (
    <Menu mode={mode} selectedKeys={getCurrentPath()}>
      <Menu.Item key="docsintro" style={leftStyle} className="menu-lg">
        <Link to="/docs/intro">Documentation</Link>
      </Menu.Item>
      <Menu.Item key="gallery" style={leftStyle} className="menu-lg">
        <Link to="/gallery">Gallery</Link>
      </Menu.Item>
      <Menu.Item key="community" style={leftStyle} className="menu-lg">
        <Link to="/community">Community</Link>
      </Menu.Item>
      <Menu.Item key="resources" style={leftStyle} className="menu-lg">
        <Link to="/resources"> Resources</Link>
      </Menu.Item>
      {toggleDrawer && (
      <Menu.Item style={rightStyle} className="menu-sm">
        <MenuOutlined onClick={toggleDrawer} className="menu-icon" />
      </Menu.Item>
      )}
      {mode === 'horizontal'
      && (
      <Menu.Item key="github" style={rightStyle}>
        <a href="https://github.com/apache/incubator-superset" target="_blank" rel="noreferrer">
          <GithubOutlined className="menu-icon" />
        </a>
      </Menu.Item>
      )}
    </Menu>
  );
};

export default class MainMenu extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      visible: false,
    };
    this.toggleDrawer = this.toggleDrawer.bind(this);
    this.onClose = this.onClose.bind(this);
  }

  onClose() {
    this.setState({
      visible: false,
    });
  }

  toggleDrawer() {
    this.setState((prevState) => ({
      visible: !prevState.visible,
    }));
  }

  render() {
    const { visible } = this.state;
    return (
      <Layout.Header css={headerStyle}>
        <a href="https://superset.incubator.apache.org">
          <img height="50" css={logoStyle} src={logoSvg} alt="logo" />
        </a>
        <MenuItems toggleDrawer={this.toggleDrawer} mode="horizontal" />
        <Drawer
          title="Menu"
          placement="right"
          closable={false}
          onClose={this.onClose}
          visible={visible}
        >
          <MenuItems mode="vertical" />
        </Drawer>
      </Layout.Header>
    );
  }
}
