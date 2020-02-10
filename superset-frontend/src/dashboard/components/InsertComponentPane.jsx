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
import cx from 'classnames';
import { t } from '@superset-ui/translation';

import NewColumn from './gridComponents/new/NewColumn';
import NewDivider from './gridComponents/new/NewDivider';
import NewHeader from './gridComponents/new/NewHeader';
import NewRow from './gridComponents/new/NewRow';
import NewTabs from './gridComponents/new/NewTabs';
import NewMarkdown from './gridComponents/new/NewMarkdown';
import SliceAdder from '../containers/SliceAdder';
import { BUILDER_PANE_TYPE } from '../util/constants';

export const SUPERSET_HEADER_HEIGHT = 59;

const propTypes = {
  height: PropTypes.number.isRequired,
  isSticky: PropTypes.bool.isRequired,
  showBuilderPane: PropTypes.func.isRequired,
};

class InsertComponentPane extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      slideDirection: 'slide-out',
    };

    this.onCloseButtonClick = this.onCloseButtonClick.bind(this);
    this.openSlicesPane = this.slide.bind(this, 'slide-in');
    this.closeSlicesPane = this.slide.bind(this, 'slide-out');
  }

  onCloseButtonClick() {
    this.props.showBuilderPane(BUILDER_PANE_TYPE.NONE);
  }

  slide(direction) {
    this.setState({
      slideDirection: direction,
    });
  }

  render() {
    return (
      <div className={cx('slider-container', this.state.slideDirection)}>
        <div className="component-layer slide-content">
          <div className="dashboard-builder-sidepane-header">
            <span>{t('Insert components')}</span>
            <i
              className="fa fa-times trigger"
              onClick={this.onCloseButtonClick}
              role="none"
            />
          </div>
          <div
            className="new-component static"
            role="none"
            onClick={this.openSlicesPane}
          >
            <div className="new-component-placeholder fa fa-area-chart" />
            <div className="new-component-label">
              {t('Your charts & filters')}
            </div>

            <i className="fa fa-arrow-right trigger" />
          </div>
          <NewTabs />
          <NewRow />
          <NewColumn />
          <NewHeader />
          <NewMarkdown />
          <NewDivider />
        </div>
        <div className="slices-layer slide-content">
          <div
            className="dashboard-builder-sidepane-header"
            onClick={this.closeSlicesPane}
            role="none"
          >
            <i className="fa fa-arrow-left trigger" />
            <span>{t('Your charts and filters')}</span>
          </div>
          <SliceAdder
            height={
              this.props.height +
              (this.props.isSticky ? SUPERSET_HEADER_HEIGHT : 0)
            }
          />
        </div>
      </div>
    );
  }
}

InsertComponentPane.propTypes = propTypes;

export default InsertComponentPane;
