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

import TableLoader from '../../components/TableLoader';

const propTypes = {
  user: PropTypes.object,
};

export default class RecentActivity extends React.PureComponent {
  render() {
    const rowLimit = 50;
    const mutator = function(data) {
      return data
        .filter(row => row.action === 'dashboard' || row.action === 'explore')
        .map(row => ({
          name: <a href={row.item_url}>{row.item_title}</a>,
          type: row.action,
          time: moment.utc(row.time).fromNow(),
          _time: row.time,
        }));
    };
    return (
      <div>
        <TableLoader
          className="table table-condensed"
          mutator={mutator}
          sortable
          dataEndpoint={`/superset/recent_activity/${this.props.user.userId}/?limit=${rowLimit}`}
        />
      </div>
    );
  }
}

RecentActivity.propTypes = propTypes;
