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
import { Dispatch, bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import * as Actions from 'src/SqlLab/actions/sqlLab';
import { RootState } from 'src/SqlLab/types';
import QueryAutoRefresh, { QueryAutoRefreshProps } from '.';

function QueryAutoRefreshConnector({
  offline,
  queries,
  actions,
  queriesLastUpdate,
}: QueryAutoRefreshProps) {
  return (
    <QueryAutoRefresh
      offline={offline}
      queries={queries}
      actions={actions}
      queriesLastUpdate={queriesLastUpdate}
    />
  );
}

function mapStateToProps({ sqlLab }: RootState) {
  return {
    offline: sqlLab.offline,
    queries: sqlLab.queries,
    queriesLastUpdate: sqlLab.queriesLastUpdate,
  };
}

function mapDispatchToProps(dispatch: Dispatch) {
  return {
    actions: bindActionCreators<any, any>(Actions, dispatch),
  };
}

export default connect<any>(
  mapStateToProps,
  mapDispatchToProps,
)(QueryAutoRefreshConnector);
