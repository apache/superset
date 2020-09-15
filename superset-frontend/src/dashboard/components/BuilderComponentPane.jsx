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
import PropTypes from 'prop-types';
import React from 'react';
import { Tabs, Tab } from 'react-bootstrap';
import { StickyContainer, Sticky } from 'react-sticky';
import { ParentSize } from '@vx/responsive';

import { t } from '@superset-ui/core';

import NewColumn from './gridComponents/new/NewColumn';
import NewDivider from './gridComponents/new/NewDivider';
import NewHeader from './gridComponents/new/NewHeader';
import NewRow from './gridComponents/new/NewRow';
import NewTabs from './gridComponents/new/NewTabs';
import NewMarkdown from './gridComponents/new/NewMarkdown';
import SliceAdder from '../containers/SliceAdder';

const propTypes = {
  topOffset: PropTypes.number,
};

const defaultProps = {
  topOffset: 0,
};

const SUPERSET_HEADER_HEIGHT = 59;

class BuilderComponentPane extends React.PureComponent {
  renderTabs(height) {
    const { isSticky } = this.props;
    return (
      <Tabs className="m-t-10 tabs-components">
        <Tab eventKey={1} title={t('Components')}>
          <NewTabs />
          <NewRow />
          <NewColumn />
          <NewHeader />
          <NewMarkdown />
          <NewDivider />
        </Tab>
        <Tab eventKey={2} title={t('Charts')} className="tab-charts">
          <SliceAdder
            height={height + (isSticky ? SUPERSET_HEADER_HEIGHT : 0)}
          />
        </Tab>
      </Tabs>
    );
  }

  render() {
    const { topOffset } = this.props;
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
                {({ style, isSticky }) => (
                  <div
                    className="viewport"
                    style={isSticky ? { ...style, top: topOffset } : null}
                  >
                    {this.renderTabs(height)}
                  </div>
                )}
              </Sticky>
            </StickyContainer>
          )}
        </ParentSize>
      </div>
    );
  }
}

BuilderComponentPane.propTypes = propTypes;
BuilderComponentPane.defaultProps = defaultProps;

export default BuilderComponentPane;
