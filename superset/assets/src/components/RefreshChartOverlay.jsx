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
import { t } from '@superset-ui/translation';
import Button from '../components/Button';

const propTypes = {
  height: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
  onQuery: PropTypes.func,
};

class RefreshChartOverlay extends React.PureComponent {
  render() {
    return (
      <div
        style={{ height: this.props.height, width: this.props.width }}
        className="explore-chart-overlay"
      >
        <div>
          <Button
            className="refresh-overlay-btn"
            onClick={this.props.onQuery}
            bsStyle="primary"
          >
            {t('Run Query')}
          </Button>
        </div>
      </div>
    );
  }
}

RefreshChartOverlay.propTypes = propTypes;

export default RefreshChartOverlay;
