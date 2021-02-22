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
import PropTypes from 'prop-types';
import moment from 'moment';
import { t } from '@superset-ui/core';

import Label from 'src/components/Label';
import { Tooltip } from 'src/common/components/Tooltip';

const propTypes = {
  onClick: PropTypes.func,
  cachedTimestamp: PropTypes.string,
  className: PropTypes.string,
};

class CacheLabel extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      tooltipContent: '',
      hovered: false,
    };
  }

  updateTooltipContent() {
    const cachedText = this.props.cachedTimestamp ? (
      <span>
        {t('Loaded data cached')}
        <b> {moment.utc(this.props.cachedTimestamp).fromNow()}</b>
      </span>
    ) : (
      t('Loaded from cache')
    );

    const tooltipContent = (
      <span>
        {cachedText}. {t('Click to force-refresh')}
      </span>
    );
    this.setState({ tooltipContent });
  }

  mouseOver() {
    this.updateTooltipContent();
    this.setState({ hovered: true });
  }

  mouseOut() {
    this.setState({ hovered: false });
  }

  render() {
    const labelType = this.state.hovered ? 'primary' : 'default';
    return (
      <Tooltip title={this.state.tooltipContent} id="cache-desc-tooltip">
        <Label
          className={`${this.props.className}`}
          type={labelType}
          onClick={this.props.onClick}
          onMouseOver={this.mouseOver.bind(this)}
          onMouseOut={this.mouseOut.bind(this)}
        >
          {t('cached')} <i className="fa fa-refresh" />
        </Label>
      </Tooltip>
    );
  }
}
CacheLabel.propTypes = propTypes;

export default CacheLabel;
