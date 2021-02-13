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
import React, { useState, useEffect, memo } from 'react';
import PropTypes from 'prop-types';
import Button from 'src/components/Button';
import Select from 'src/components/Select';
import { styled, t, SupersetClient } from '@superset-ui/core';

import Loading from '../../components/Loading';
import QueryTable from './QueryTable';
import {
  now,
  epochTimeXHoursAgo,
  epochTimeXDaysAgo,
  epochTimeXYearsAgo,
} from '../../modules/dates';
import { STATUS_OPTIONS, TIME_OPTIONS } from '../constants';
import AsyncSelect from '../../components/AsyncSelect';

const propTypes = {
  actions: PropTypes.object.isRequired,
  // why is height required and then never used or invoked?
  displayLimit: PropTypes.number.isRequired,
};

const TableWrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
`;

const TableStyles = styled.div`
  table {
    background-color: ${({ theme }) => theme.colors.grayscale.light4};
  }

  .table > thead > tr > th {
    border-bottom: ${({ theme }) => theme.gridUnit / 2}px solid
      ${({ theme }) => theme.colors.grayscale.light2};
    background: ${({ theme }) => theme.colors.grayscale.light4};
  }
`;

const StyledTableStylesContainer = styled.div`
  overflow: auto;
`;
// height is invoked in the interface above, and I also saw that there were some functions that pass height into this function, but it is never used
function QuerySearch({ actions, displayLimit }) {
  const [databaseId, setDatabaseId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [searchText, setSearchText] = useState(null);
  const [from, setFrom] = useState('28 days ago');
  const [to, setTo] = useState('now');
  const [status, setStatus] = useState('success');
  const [queriesArray, setQueriesArray] = useState([]);
  const [queriesLoading, setQueriesLoading] = useState(true);

  const getTimeFromSelection = selection => {
    switch (selection) {
      case 'now':
        return now();
      case '1 hour ago':
        return epochTimeXHoursAgo(1);
      case '1 day ago':
        return epochTimeXDaysAgo(1);
      case '7 days ago':
        return epochTimeXDaysAgo(7);
      case '28 days ago':
        return epochTimeXDaysAgo(28);
      case '90 days ago':
        return epochTimeXDaysAgo(90);
      case '1 year ago':
        return epochTimeXYearsAgo(1);
      default:
        return null;
    }
  };

  const insertParams = (baseUrl, params) => {
    const validParams = params.filter(function (p) {
      return p !== '';
    });
    return `${baseUrl}?${validParams.join('&')}`;
  };

  const refreshQueries = () => {
    setQueriesLoading(true);
    const params = [
      userId ? `user_id=${userId}` : '',
      databaseId ? `database_id=${databaseId}` : '',
      searchText ? `search_text=${searchText}` : '',
      status ? `status=${status}` : '',
      from ? `from=${getTimeFromSelection(from)}` : '',
      to ? `to=${getTimeFromSelection(to)}` : '',
    ];

    SupersetClient.get({
      endpoint: insertParams('/superset/search_queries', params),
    })
      .then(({ json }) => {
        setQueriesArray(json);
        setQueriesLoading(false);
      })
      .catch(() => {
        actions.addDangerToast(t('An error occurred when refreshing queries'));
      });
  };
  // functionally this is closest to componentDidMount, though Abramov recommends that it is better if you have a more robust dependency array, though I am afraid that will go into a useCallback loop like before. Though, I could remove some of the refreshQueries in the other methods, and instead have the dependency array focus on when values are changed? That would maybe not play nicely with onChange though.
  useEffect(() => {
    refreshQueries();
  }, []);

  const onUserClicked = userId => {
    setUserId(userId);
    refreshQueries();
  };
  // add these to dependency array instead of having their own functions.

  const onDbClicked = dbId => {
    // By my reading of this, it is setting state, and then running the refreshQueries function. Is that correct?
    setDatabaseId(dbId);
    refreshQueries();
  };

  const onKeyDown = event => {
    if (event.keyCode === 13) {
      refreshQueries();
    }
  };

  const userMutator = data =>
    data.result.map(({ value, text }) => ({
      label: text,
      value,
    }));

  const dbMutator = data => {
    const options = data.result.map(db => ({
      value: db.id,
      label: db.database_name,
    }));
    actions.setDatabases(data.result);
    if (data.result.length === 0) {
      actions.addDangerToast(
        t("It seems you don't have access to any database"),
      );
    }
    return options;
  };

  return (
    <TableWrapper>
      <div id="search-header" className="row space-1">
        <div className="col-sm-2">
          <AsyncSelect
            dataEndpoint="api/v1/query/related/user"
            mutator={userMutator}
            value={userId}
            onChange={selected => setUserId(selected?.value)}
            placeholder={t('Filter by user')}
          />
        </div>
        <div className="col-sm-2">
          <AsyncSelect
            onChange={db => setDatabaseId(db?.value)}
            dataEndpoint="/api/v1/database/?q=(filters:!((col:expose_in_sqllab,opr:eq,value:!t)))"
            value={databaseId}
            mutator={dbMutator}
            placeholder={t('Filter by database')}
          />
        </div>
        <div className="col-sm-4">
          <input
            type="text"
            onChange={event => setSearchText(event.target.value)}
            onKeyDown={onKeyDown}
            className="form-control input-sm"
            placeholder={t('Query search string')}
          />
        </div>
        <div className="col-sm-4 search-date-filter-container">
          <Select
            name="select-from"
            placeholder={t('[From]-')}
            options={TIME_OPTIONS.slice(1, TIME_OPTIONS.length).map(xt => ({
              value: xt,
              label: xt,
            }))}
            value={from}
            autosize={false}
            onChange={selected => setFrom(selected?.value)}
          />

          <Select
            name="select-to"
            placeholder={t('[To]-')}
            options={TIME_OPTIONS.map(xt => ({ value: xt, label: xt }))}
            value={to}
            autosize={false}
            onChange={selected => setTo(selected?.value)}
          />

          <Select
            name="select-status"
            placeholder={t('Filter by status')}
            options={Object.keys(STATUS_OPTIONS).map(s => ({
              value: s,
              label: s,
            }))}
            value={status}
            isLoading={false}
            autosize={false}
            onChange={selected => setStatus(selected?.value)}
          />

          <Button
            buttonSize="small"
            buttonStyle="success"
            onClick={refreshQueries}
          >
            {t('Search')}
          </Button>
        </div>
      </div>
      <StyledTableStylesContainer>
        {queriesLoading ? (
          <Loading />
        ) : (
          <TableStyles>
            <QueryTable
              columns={[
                'state',
                'db',
                'user',
                'time',
                'progress',
                'rows',
                'sql',
                'querylink',
              ]}
              onUserClicked={onUserClicked}
              onDbClicked={onDbClicked}
              queries={queriesArray}
              actions={actions}
              displayLimit={displayLimit}
            />
          </TableStyles>
        )}
      </StyledTableStylesContainer>
    </TableWrapper>
  );
}
QuerySearch.propTypes = propTypes;
// using memo here because the original component was a Pure Component, and memo replicates that.
export default memo(QuerySearch);
