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
import { t, SupersetClient } from '@superset-ui/core';
import { debounce } from 'lodash';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import ListViewCard from 'src/components/ListViewCard';

class SavedQueries extends React.PureComponent {
  constructor(props: Readonly<{}>) {
    super(props);
    this.state = {
      queries: [],
    };
  }
  componentDidMount(){
    this.fetchData();
  }
  fetchData = () => {
    try {
      const { json } = SupersetClient.get({
        endpoint: `/api/v1/query/`,
      });
      this.setState({ queries: json.result });
    } catch (e) {
      return console.log(e);
    }
  };
  render() {
    return (
      <div>
        {this.state.queries.map(q => (
          <ListViewCard
            title={q.database_name}
            loading={false}
            description={t('Last run ', q.end_time)}
          />
        ))}
      </div>
    )
  }
}

export default SavedQueries; 