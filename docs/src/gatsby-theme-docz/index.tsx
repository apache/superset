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
import AnchorNavigator from '../components/AnchorNavigator';
import NextLinks from '../components/next';

import 'antd/dist/antd.css';

interface Props {
  children: React.ReactNode;
}

const docLayout = css`
  display: flex;
  flex-direction: row;
  .docSearch-content {
    word-wrap: break-all;
    width: 100%;
  }

  // Hacks to disable Swagger UI's "try it out" interactive mode
  .try-out, .auth-wrapper, .information-container {
    display: none;
  }
`;

const Theme = ({ children }: Props) => {
  const config = useConfig();
  return (
    <ThemeProvider theme={config}>
      <Layout>
        <SEO title="Documentation" />
        <div css={docLayout}>
          <div className="docSearch-content">
            {children}
          </div>
          <AnchorNavigator />
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
