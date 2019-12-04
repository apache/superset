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
import { SupersetClient } from '@superset-ui/connection';

import * as Actions from '../actions/sqlLab';

const QUERY_UPDATE_FREQ = 2000;
const QUERY_UPDATE_BUFFER_MS = 5000;
const MAX_QUERY_AGE_TO_POLL = 21600000;
const QUERY_TIMEOUT_LIMIT = 10000;

class QueryAutoRefresh extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      offline: props.offline,
    };
  }
  UNSAFE_componentWillMount() {
    this.startTimer();
  }
  componentDidUpdate(prevProps) {
    if (prevProps.offline !== this.state.offline) {
      this.props.actions.setUserOffline(this.state.offline);
    }
  }
  componentWillUnmount() {
    this.stopTimer();
  }
  shouldCheckForQueries() {
    // if there are started or running queries, this method should return true
    const { queries } = this.props;
    const now = new Date().getTime();
    const isQueryRunning = q =>
      ['running', 'started', 'pending', 'fetching'].indexOf(q.state) >= 0;

    return Object.values(queries).some(
      q => isQueryRunning(q) && now - q.startDttm < MAX_QUERY_AGE_TO_POLL,
    );
  }
  startTimer() {
    if (!this.timer) {
      this.timer = setInterval(this.stopwatch.bind(this), QUERY_UPDATE_FREQ);
    }
  }
  stopTimer() {
    clearInterval(this.timer);
    this.timer = null;
  }
  stopwatch() {
    // only poll /superset/queries/ if there are started or running queries
    if (this.shouldCheckForQueries()) {
      SupersetClient.get({
        endpoint: `/superset/queries/${this.props.queriesLastUpdate -
          QUERY_UPDATE_BUFFER_MS}`,
        timeout: QUERY_TIMEOUT_LIMIT,
      })
        .then(({ json }) => {
          if (Object.keys(json).length > 0) {
            this.props.actions.refreshQueries(json);
          }
          this.setState({ offline: false });
        })
        .catch(() => {
          this.setState({ offline: true });
        });
    } else {
      this.setState({ offline: false });
    }
  }
  render() {
    return null;
  }
}
QueryAutoRefresh.propTypes = {
  offline: PropTypes.bool.isRequired,
  queries: PropTypes.object.isRequired,
  actions: PropTypes.object.isRequired,
  queriesLastUpdate: PropTypes.number.isRequired,
};

function mapStateToProps({ sqlLab }) {
  return {
    offline: sqlLab.offline,
    queries: sqlLab.queries,
    queriesLastUpdate: sqlLab.queriesLastUpdate,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(QueryAutoRefresh);
