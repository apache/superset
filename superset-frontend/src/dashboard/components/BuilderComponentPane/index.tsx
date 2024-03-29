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

import SliceAdder from 'src/dashboard/containers/SliceAdder';
import dashboardComponents from 'src/visualizations/presets/dashboardComponents';
import NewColumn from '../gridComponents/new/layout/NewColumn';
import NewDivider from '../gridComponents/new/layout/NewDivider';
import NewHeader from '../gridComponents/new/layout/NewHeader';
import NewRow from '../gridComponents/new/layout/NewRow';
import NewTabs from '../gridComponents/new/layout/NewTabs';
import NewMarkdown from '../gridComponents/new/layout/NewMarkdown';
import NewDynamicComponent from '../gridComponents/new/NewDynamicComponent';
import NewIkiTable from '../gridComponents/new/components/NewIkiTable';
import NewIkiProcessBuilder from '../gridComponents/new/components/NewIkiProcessBuilder';
import NewIkiRunPipeline from '../gridComponents/new/components/NewIkiRunPipeline';
import NewDeepCast from '../gridComponents/new/components/NewDeepCast';
import NewIkiEitlRow from '../gridComponents/new/components/NewIkiEitlRow';
import NewIkiEitlColumn from '../gridComponents/new/components/NewIkiEitlColumn';
import NewDyanmicMarkdown from '../gridComponents/new/components/NewDynamicMarkdown';
// import NewIkiExplainability from '../gridComponents/new/NewIkiExplainability';
import NewIkiModelMetrics from '../gridComponents/new/NewIkiModelMetrics';
import NewIkiDatasetDownload from '../gridComponents/new/components/NewIkiDatasetDownload';
import NewExternalDatasets from '../gridComponents/new/components/NewExternalDatasets';
import NewForecast from '../gridComponents/new/components/NewForecast';
import NewForecastModule from '../gridComponents/new/components/NewForecastModule';

export interface BCPProps {
  isStandalone: boolean;
  topOffset: number;
  hasDynamicMarkdown?: boolean;
  sidepanelExpanded?: boolean;
  handleExpandSidepanel?: () => void;
  handleCollapseSidepanel?: () => void;
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
  hasDynamicMarkdown,
  sidepanelExpanded,
  handleExpandSidepanel,
  handleCollapseSidepanel,
}) => (
  <DashboardBuilderSidepane
    topOffset={topOffset}
    className="dashboard-builder-sidepane"
    style={{ width: hasDynamicMarkdown ? '40px' : '374px' }}
  >
    {/* <button
      className="sidepanel-toggle-button"
      type="button"
      onClick={
        sidepanelExpanded ? handleCollapseSidepanel : handleExpandSidepanel
      }
    >
      <svg
        className={`sidepanel-toggle-btn-svg ${
          sidepanelExpanded ? 'expanded' : 'collapsed'
        }`}
        width="14"
        height="7"
        viewBox="0 0 14 7"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        // style="transform: rotate(90deg);"
      >
        <path d="M6.58824e-05 5.88002C-0.000423903 5.73593 0.0313676 5.59357 0.0931037 5.46339C0.15484 5.33321 0.244952 5.21852 0.356819 5.12774L6.14199 0.469403C6.31451 0.327549 6.53092 0.25 6.75425 0.25C6.97758 0.25 7.19399 0.327549 7.36651 0.469403L13.1517 5.2917C13.3486 5.45541 13.4724 5.69065 13.4959 5.94568C13.5194 6.2007 13.4407 6.45463 13.277 6.65159C13.1134 6.84855 12.8782 6.97241 12.6232 6.99592C12.3683 7.01943 12.1144 6.94067 11.9175 6.77697L6.74943 2.46583L1.58134 6.6323C1.43982 6.75023 1.26748 6.82515 1.08471 6.84818C0.901951 6.87121 0.716417 6.84139 0.550067 6.76226C0.383716 6.68312 0.243512 6.55797 0.146041 6.40162C0.0485703 6.24527 -0.002086 6.06426 6.58824e-05 5.88002Z" />
      </svg>
    </button> */}
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
                    width: hasDynamicMarkdown ? '40px' : '374px',
                    ...(hasDynamicMarkdown && { opacity: '0.24' }),
                  }}
                >
                  <BuilderComponentPaneTabs
                    id="tabs"
                    className="tabs-components"
                    data-test="dashboard-builder-component-pane-tabs-navigation"
                  >
                    <Tabs.TabPane key={1} tab={t('Layout')}>
                      <NewTabs />
                      <NewRow />
                      <NewColumn />
                      <NewHeader />
                      <NewMarkdown />
                      <NewDivider />
                    </Tabs.TabPane>
                    <Tabs.TabPane key={2} tab={t('Components')}>
                      <NewDyanmicMarkdown />
                      <NewIkiTable />
                      <NewIkiProcessBuilder />
                      <NewIkiRunPipeline />
                      <NewDeepCast />
                      <NewIkiEitlRow />
                      <NewIkiEitlColumn />
                      <NewForecastModule />
                      <NewIkiDatasetDownload />
                      <NewIkiModelMetrics />
                      <NewExternalDatasets />
                      <NewForecast />

                      {/* <NewIkiExplainability /> */}
                      {dashboardComponents
                        .getAll()
                        .map(({ key: componentKey, metadata }) => (
                          <NewDynamicComponent
                            metadata={metadata}
                            componentKey={componentKey}
                          />
                        ))}
                    </Tabs.TabPane>
                    <Tabs.TabPane
                      key={3}
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
