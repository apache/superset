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
import withToasts from 'src/messageToasts/enhancers/withToasts';
import { Dropdown, Menu } from 'src/common/components';
import ListViewCard from 'src/components/ListViewCard';
// import FaveStar from 'src/components/FaveStar';
import Icon from 'src/components/Icon';

interface StateProps {
  queries: Array<object>;
}

class SavedQueries extends React.PureComponent {
  constructor(props: StateProps) {
    super(props);
    this.state = {
      queries: [],
    };
  }

  componentDidMount() {
    this.fetchData();
  }

  // eslint-disable-next-line consistent-return
  fetchData = async () => {
    try {
      const { json } = await SupersetClient.get({
        endpoint: `/api/v1/query/`,
      });
      this.setState({ queries: json.result });
    } catch (e) {
      return console.log(e);
    }
  };

  render() {
    const menu = (
      <Menu>
        <Menu.Item>Delete</Menu.Item>
      </Menu>
    );
    // console.log('queries', this.state.queries)
    return (
      <>
        {this.state.queries.map(q => (
          <ListViewCard
            title={q.database.database_name}
            rows={q.rows}
            loading={false}
            description={t('Last run ', q.end_time)}
            showImg={false}
            actions={
              <ListViewCard.Actions>
                <Dropdown overlay={menu}>
                  <Icon name="more-horiz" />
                </Dropdown>
              </ListViewCard.Actions>
            }
          />
        ))}
      </>
    );
  }
}

export default withToasts(SavedQueries);
