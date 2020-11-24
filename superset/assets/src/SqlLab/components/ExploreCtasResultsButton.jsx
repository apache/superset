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
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import Dialog from 'react-bootstrap-dialog';
import { t } from '@superset-ui/core';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';

import { exploreChart } from '../../explore/exploreUtils';
import * as actions from '../actions/sqlLab';
import Button from 'src/components/Button';

const propTypes = {
  actions: PropTypes.object.isRequired,
  table: PropTypes.string.isRequired,
  schema: PropTypes.string,
  dbId: PropTypes.number.isRequired,
  errorMessage: PropTypes.string,
  templateParams: PropTypes.string,
  onClick: PropTypes.func.isRequired,
};
const defaultProps = {
  vizRequest: {},
};

class ExploreCtasResultsButton extends React.PureComponent {
  constructor(props) {
    super(props);
    this.visualize = this.visualize.bind(this);
    this.onClick = this.onClick.bind(this);
  }
  render() {
    return (
      <>
        <Button
          buttonSize="small"
          onClick={this.props.onClick}
          tooltip={t('Explore the result set in the data exploration view')}
        >
          <InfoTooltipWithTrigger
            icon="line-chart"
            placement="top"
            label="explore"
          />{' '}
          {t('Explore')}
        </Button>
        <Dialog
          ref={el => {
            this.dialog = el;
          }}
        />
      </>
    );
  }
}
ExploreCtasResultsButton.propTypes = propTypes;
ExploreCtasResultsButton.defaultProps = defaultProps;

function mapStateToProps({ sqlLab, common }) {
  return {
    errorMessage: sqlLab.errorMessage,
    timeout: common.conf ? common.conf.SUPERSET_WEBSERVER_TIMEOUT : null,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export { ExploreCtasResultsButton };
export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(ExploreCtasResultsButton);
