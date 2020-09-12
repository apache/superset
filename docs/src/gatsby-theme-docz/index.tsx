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
import { theme, useConfig } from 'docz';
import { ThemeProvider } from 'theme-ui';
import { css } from '@emotion/core';
import SEO from '../components/seo';
import Layout from '../components/layout';
import HeaderNav from '../components/sidenav';
import NextLinks from '../components/next';

import 'antd/dist/antd.css';

interface Props {
  children: React.ReactNode;
}

const docLayout = css`
  display: flex;
  flex-direction: row;
  .headerNav {
    position: fixed;
    top: 64px;
    right: 0;
    width: 250px;
    padding: 16px;
    height: 605px;
    overflow: auto;
    ul {
      font-size: 12px;
      li {
        height: 25px;
        line-height: 25px;
        word-wrap: break-word;
      }
    }
  }
`;

const Theme = ({ children }: Props) => {
  const config = useConfig();
  return (
    <ThemeProvider theme={config}>
      <Layout>
        <SEO title="Documents" />
        <div css={docLayout}>
          <div>{children}</div>
          <div className="headerNav">
            <HeaderNav />
          </div>
        </div>
        <div>
          <NextLinks />
        </div>
      </Layout>
    </ThemeProvider>
  );
};

// @ts-ignore
export default theme()(Theme);
