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
/* eslint-env browser */
import React from 'react';
import Tabs from 'src/components/Tabs';
import { t, styled, css } from '@superset-ui/core';
import SliceAdder from 'src/dashboard/containers/SliceAdder';
import dashboardComponents from 'src/visualizations/presets/dashboardComponents';
import NewColumn from '../gridComponents/new/NewColumn';
import NewDivider from '../gridComponents/new/NewDivider';
import NewHeader from '../gridComponents/new/NewHeader';
import NewRow from '../gridComponents/new/NewRow';
import NewTabs from '../gridComponents/new/NewTabs';
import NewMarkdown from '../gridComponents/new/NewMarkdown';
import NewDynamicComponent from '../gridComponents/new/NewDynamicComponent';

export interface BCPProps {
  isStandalone: boolean;
  topOffset: number;
}

const BuilderComponentPaneTabs = styled(Tabs)`
  line-height: inherit;
  margin-top: ${({ theme }) => theme.gridUnit * 2}px;
  height: 100%;
`;

const DashboardBuilderSidepane = styled.div<{
  topOffset: number;
}>`
  position: sticky;
  right: 0;
  top: ${({ topOffset }) => topOffset}px;
  height: calc(100vh - ${({ topOffset }) => topOffset}px);

  & .ant-tabs-content-holder {
    height: 100%;
    & .ant-tabs-content {
      height: 100%;
    }
  }
`;

const BuilderComponentPane: React.FC<BCPProps> = ({ topOffset = 0 }) => (
  <DashboardBuilderSidepane
    topOffset={topOffset}
    className="dashboard-builder-sidepane"
    data-test="dashboard-builder-sidepane"
  >
    <div className="viewport">
      <BuilderComponentPaneTabs
        id="tabs"
        className="tabs-components"
        data-test="dashboard-builder-component-pane-tabs-navigation"
      >
        <Tabs.TabPane
          key={1}
          tab={t('Charts')}
          className="tab-charts"
          css={css`
            height: 100%;
          `}
        >
          <SliceAdder />
        </Tabs.TabPane>
        <Tabs.TabPane key={2} tab={t('Layout elements')}>
          <NewTabs />
          <NewRow />
          <NewColumn />
          <NewHeader />
          <NewMarkdown />
          <NewDivider />
          {dashboardComponents
            .getAll()
            .map(({ key: componentKey, metadata }) => (
              <NewDynamicComponent
                metadata={metadata}
                componentKey={componentKey}
              />
            ))}
        </Tabs.TabPane>
      </BuilderComponentPaneTabs>
    </div>
  </DashboardBuilderSidepane>
);

export default BuilderComponentPane;
