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
import tinycolor from 'tinycolor2';
import Tabs from '@superset-ui/core/components/Tabs';
import { t, css, SupersetTheme } from '@superset-ui/core';
import SliceAdder from 'src/dashboard/containers/SliceAdder';
import dashboardComponents from 'src/visualizations/presets/dashboardComponents';
import NewColumn from '../gridComponents/new/NewColumn';
import NewDivider from '../gridComponents/new/NewDivider';
import NewHeader from '../gridComponents/new/NewHeader';
import NewRow from '../gridComponents/new/NewRow';
import NewTabs from '../gridComponents/new/NewTabs';
import NewMarkdown from '../gridComponents/new/NewMarkdown';
import NewDynamicComponent from '../gridComponents/new/NewDynamicComponent';

const BUILDER_PANE_WIDTH = 374;

const TABS_KEYS = {
  CHARTS: 'CHARTS',
  LAYOUT_ELEMENTS: 'LAYOUT_ELEMENTS',
};

const BuilderComponentPane = ({ topOffset = 0 }) => (
  <div
    data-test="dashboard-builder-sidepane"
    css={css`
      position: sticky;
      right: 0;
      top: ${topOffset}px;
      height: calc(100vh - ${topOffset}px);
      width: ${BUILDER_PANE_WIDTH}px;
    `}
  >
    <div
      css={(theme: SupersetTheme) => css`
        position: absolute;
        height: 100%;
        width: ${BUILDER_PANE_WIDTH}px;
        box-shadow: -${theme.sizeUnit}px 0 ${theme.sizeUnit}px 0
          ${tinycolor(theme.colorBorder).setAlpha(0.1).toRgbString()};
        background-color: ${theme.colorBgBase};
      `}
    >
      <Tabs
        data-test="dashboard-builder-component-pane-tabs-navigation"
        id="tabs"
        css={(theme: SupersetTheme) => css`
          line-height: inherit;
          margin-top: ${theme.sizeUnit * 2}px;
          height: 100%;

          & .ant-tabs-content-holder {
            height: 100%;
            & .ant-tabs-content {
              height: 100%;
            }
          }
        `}
        items={[
          {
            key: TABS_KEYS.CHARTS,
            label: t('Charts'),
            children: (
              <div
                css={css`
                  height: calc(100vh - ${topOffset * 2}px);
                `}
              >
                <SliceAdder />
              </div>
            ),
          },
          {
            key: TABS_KEYS.LAYOUT_ELEMENTS,
            label: t('Layout elements'),
            children: (
              <>
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
                      key={componentKey}
                      metadata={metadata}
                      componentKey={componentKey}
                    />
                  ))}
              </>
            ),
          },
        ]}
      />
    </div>
  </div>
);

export default BuilderComponentPane;
