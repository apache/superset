import React from 'react';
import { Link } from 'gatsby';
import { Layout, Menu, Button } from 'antd';
import { css } from '@emotion/core';

import logoSvg from '../images/superset-logo-horiz.svg';
import Footer from './footer';
import SEO from './seo';
import AppMenu from './menu';
import 'antd/dist/antd.css';
import './layout.css';

const { Header, Sider } = Layout;

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
    max-width: 800px;
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
  left: 250px;
  right: 0px;
  bottom: 0px;
  overflow: visible;
  aside {
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
  children: React.ReactNode,
}

const AppLayout = ({ children }: Props) => {
  const isOnDocsPage = typeof window !== 'undefined' && window.location.pathname.indexOf('docs') > 0;

  return (
    <Layout css={layoutStyles}>
      <SEO title="Welcome" />
      <Header css={headerStyle}>
        <Link to="/">
          <img height="50" css={logoStyle} src={logoSvg} alt="logo" />
        </Link>
        <Menu mode="horizontal">
          <Menu.Item>
            <Link to="/community">Community</Link>
          </Menu.Item>
          <Menu.Item>
            <Link to="/resources"> Resources</Link>
          </Menu.Item>
          <Menu.Item>
            <Link to="/docs/intro">Documentation</Link>
          </Menu.Item>
        </Menu>
        <div css={getStartedButtonStyle}>
          <Link to="/docs/intro">
            <Button type="primary" size="large">
              Get Started
            </Button>
          </Link>
        </div>
      </Header>
      {isOnDocsPage ? (
        <>
          <Layout css={contentLayoutDocsStyle}>
            {isOnDocsPage && (
              <Sider width={250} css={sidebarStyle}>
                <AppMenu />
              </Sider>
            )}
            <Layout css={contentStyle}>
              <div css={centerLayoutStyle}>{children}</div>
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
