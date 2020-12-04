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
import Tabs from 'src/common/components/Tabs';
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
  topOffset: number;
}

const SUPERSET_HEADER_HEIGHT = 59;

const BuilderComponentPaneTabs = styled(Tabs)`
  line-height: inherit;
  margin-top: ${({ theme }) => theme.gridUnit * 2}px;
`;

const BuilderComponentPane: React.FC<BCPProps> = ({ topOffset = 0 }) => {
  return (
    <div
      className="dashboard-builder-sidepane"
      style={{
        height: `calc(100vh - ${topOffset + SUPERSET_HEADER_HEIGHT}px)`,
      }}
    >
      <ParentSize>
        {({ height }) => (
          <StickyContainer>
            <Sticky topOffset={-topOffset} bottomOffset={Infinity}>
              {({ style, isSticky }: { style: any; isSticky: boolean }) => (
                <div
                  className="viewport"
                  style={isSticky ? { ...style, top: topOffset } : null}
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
              )}
            </Sticky>
          </StickyContainer>
        )}
      </ParentSize>
    </div>
  );
};

export default BuilderComponentPane;
