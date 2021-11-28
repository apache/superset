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
import { StickyContainer, Sticky } from 'react-sticky';
import { ParentSize } from '@vx/responsive';

import { t, styled } from '@superset-ui/core';

import NewColumn from './gridComponents/new/NewColumn';
import NewDivider from './gridComponents/new/NewDivider';
import NewHeader from './gridComponents/new/NewHeader';
import NewRow from './gridComponents/new/NewRow';
import NewTabs from './gridComponents/new/NewTabs';
import NewMarkdown from './gridComponents/new/NewMarkdown';
import SliceAdder from '../containers/SliceAdder';

export interface BCPProps {
  isStandalone: boolean;
  topOffset: number;
}

const SUPERSET_HEADER_HEIGHT = 59;
const SIDEPANE_ADJUST_OFFSET = 4;
const SIDEPANE_HEADER_HEIGHT = 64; // including margins
const SIDEPANE_FILTERBAR_HEIGHT = 56;

const BuilderComponentPaneTabs = styled(Tabs)`
  line-height: inherit;
  margin-top: ${({ theme }) => theme.gridUnit * 2}px;
`;

const DashboardBuilderSidepane = styled.div<{
  topOffset: number;
}>`
  height: 100%;
  position: fixed;
  right: 0;
  top: 0;

  .ReactVirtualized__List {
    padding-bottom: ${({ topOffset }) =>
      `${
        SIDEPANE_HEADER_HEIGHT +
        SIDEPANE_FILTERBAR_HEIGHT +
        SIDEPANE_ADJUST_OFFSET +
        topOffset
      }px`};
  }
`;

const BuilderComponentPane: React.FC<BCPProps> = ({
  isStandalone,
  topOffset = 0,
}) => (
  <DashboardBuilderSidepane
    topOffset={topOffset}
    className="dashboard-builder-sidepane"
  >
    <ParentSize>
      {({ height }) => (
        <StickyContainer>
          <Sticky topOffset={-topOffset} bottomOffset={Infinity}>
            {({ style, isSticky }: { style: any; isSticky: boolean }) => {
              const { pageYOffset } = window;
              const hasHeader =
                pageYOffset < SUPERSET_HEADER_HEIGHT && !isStandalone;
              const withHeaderTopOffset =
                topOffset +
                (SUPERSET_HEADER_HEIGHT - pageYOffset - SIDEPANE_ADJUST_OFFSET);

              return (
                <div
                  className="viewport"
                  style={{
                    ...style,
                    top: hasHeader ? withHeaderTopOffset : topOffset,
                  }}
                >
                  <BuilderComponentPaneTabs
                    id="tabs"
                    className="tabs-components"
                    data-test="dashboard-builder-component-pane-tabs-navigation"
                  >
                    <Tabs.TabPane key={1} tab={t('Components')}>
                      <NewTabs />
                      <NewRow />
                      <NewColumn />
                      <NewHeader />
                      <NewMarkdown />
                      <NewDivider />
                    </Tabs.TabPane>
                    <Tabs.TabPane
                      key={2}
                      tab={t('Charts')}
                      className="tab-charts"
                    >
                      <SliceAdder
                        height={
                          height + (isSticky ? SUPERSET_HEADER_HEIGHT : 0)
                        }
                      />
                    </Tabs.TabPane>
                  </BuilderComponentPaneTabs>
                </div>
              );
            }}
          </Sticky>
        </StickyContainer>
      )}
    </ParentSize>
  </DashboardBuilderSidepane>
);

export default BuilderComponentPane;
