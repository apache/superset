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
import React, { useEffect, useState } from 'react';
import { t } from '@superset-ui/core';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import { Dropdown, Menu } from 'src/common/components';
import { useListViewResource } from 'src/views/CRUD/hooks';
import ListViewCard from 'src/components/ListViewCard';
import Icon from 'src/components/Icon';
import { addDangerToast } from 'src/messageToasts/actions';

const PAGE_SIZE = 3;

interface Query {
  sql_tables: array;
  database: {
    database_name: string;
  };
  rows: string;
  description: string;
  end_time: string;
  addDangerToast: () => void;
}

interface SavedQueriesProps {
  user: {
    userId: string | number;
  };
  queryFilter: string;
}

const SavedQueries = ({ user, queryFilter }: SavedQueriesProps) => {
  const {
    state: { loading, resourceCollection: queries },
    fetchData,
  } = useListViewResource<Query>('saved_query', t('query'), addDangerToast);
  const getFilters = () => {
    const filters = [];

    if (queryFilter === 'Mine') {
      filters.push({
        id: 'created_by',
        operator: 'rel_o_m',
        value: `${user?.userId}`,
      });
    } else {
      filters.push({
        id: 'id',
        operator: 'saved_query_is_fav',
        value: true,
      });
    }
    return filters;
  };

  useEffect(() => {
    fetchData({
      pageIndex: 0,
      pageSize: PAGE_SIZE,
      sortBy: [
        {
          id: 'changed_on_delta_humanized',
          desc: true,
        },
      ],
      filters: getFilters(),
    });
  }, [queryFilter]);

  const menu = (
    <Menu>
      <Menu.Item>Delete</Menu.Item>
    </Menu>
  );

  return (
    <>
      {queries ? (
        queries.map(q => (
          <ListViewCard
            imgFallbackURL="/static/assets/images/dashboard-card-fallback.png"
            imgURL=""
            title={q.database.database_name}
            rows={q.rows}
            tableName={q.sql_tables[0].table}
            loading={loading}
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
        ))
      ) : (
        <span>You have no Saved Queries!</span>
      )}
    </>
  );
};

export default withToasts(SavedQueries);
