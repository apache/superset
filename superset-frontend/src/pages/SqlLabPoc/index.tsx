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
import { CSSObject } from '@emotion/react';
import { css, styled } from '@superset-ui/core';
import Icons from 'src/components/Icons';

const PlaceholderStyles: CSSObject = css`
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
`;

const MainPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: row;
`;

const Toolbar = () => {
  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin: 8px;
      `}
    >
      <Icons.Table />
      <Icons.NavDashboard />
    </div>
  );
};

const LeftPanel = () => {
  const plugins = [];
  for (let i = 0; i < 3; i++) {
    plugins.push(
      <div
        css={theme => css`
          ${PlaceholderStyles};
          border-bottom: 1px solid ${theme.colors.grayscale.light2};
        `}
      >
        <Icons.Cards />
        {`Plugin ${i + 1}`}
      </div>,
    );
  }
  return (
    <div
      css={theme => css`
        width: 400px;
        gap: 12px;
        display: flex;
        flex-direction: column;
        border-left: 1px solid ${theme.colors.grayscale.light2};
        border-right: 1px solid ${theme.colors.grayscale.light2};
      `}
    >
      {plugins}
    </div>
  );
};

const CenterPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const CenterTopPanel = () => {
  return (
    <div
      css={theme => css`
        ${PlaceholderStyles};
        border-bottom: 1px solid ${theme.colors.grayscale.light2};
      `}
    >
      <Icons.Cards />
      SQL Editor plugin
    </div>
  );
};

const CenterBottomPanel = () => {
  return (
    <div css={PlaceholderStyles}>
      <Icons.Cards />
      SQL execution plugins
    </div>
  );
};

const RightPanel = () => {
  return (
    <div
      css={theme => css`
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 12px;
        border-left: 1px solid ${theme.colors.grayscale.light2};
        width: 400px;
      `}
    >
      <Icons.Cards />
      AI Chat plugin
    </div>
  );
};

const SqlLabPoc = () => {
  return (
    <MainPanel>
      <Toolbar />
      <LeftPanel />
      <CenterPanel>
        <CenterTopPanel />
        <CenterBottomPanel />
      </CenterPanel>
      <RightPanel />
    </MainPanel>
  );
};

export default SqlLabPoc;
