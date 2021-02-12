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
import React, { useState, useEffect } from 'react';
import Button from 'src/components/Button';
import Select from 'src/components/Select';
import { styled, t, SupersetClient } from '@superset-ui/core';
import { debounce } from 'lodash';
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

interface propTypes {
  actions: {
    addDangerToast: (msg: string) => void;
    setDatabases: (data: Record<string, any>) => Record<string, any>;
  };
  displayLimit: number;
}

interface userMutatorProps {
  value: number;
  text: string;
}

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
<<<<<<< HEAD:superset-frontend/src/SqlLab/components/QuerySearch.tsx
function QuerySearch({ actions, displayLimit }: propTypes) {
  const [databaseId, setDatabaseId] = useState<any>('');
  const [userId, setUserId] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');
  const [from, setFrom] = useState<string>('28 days ago');
  const [to, setTo] = useState<string>('now');
  const [status, setStatus] = useState<string>('success');
  const [queriesArray, setQueriesArray] = useState<any>([]);
  const [queriesLoading, setQueriesLoading] = useState<boolean>(true);

  const getTimeFromSelection = (selection: string) => {
=======
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
>>>>>>> 3f3c98b7f... switching:superset-frontend/src/SqlLab/components/QuerySearch.jsx
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

  const insertParams = (baseUrl: string, params: string[]) => {
    const validParams = params.filter(function (p) {
      return p !== '';
    });
    return `${baseUrl}?${validParams.join('&')}`;
  };

  const refreshQueries = async () => {
    setQueriesLoading(true);
    const params = [
      userId && `user_id=${userId}`,
      databaseId && `database_id=${databaseId}`,
      searchText && `search_text=${searchText}`,
      status && `status=${status}`,
      from && `from=${getTimeFromSelection(from)}`,
      to && `to=${getTimeFromSelection(to)}`,
    ];

    // make into async method
    try {
      const promise = await SupersetClient.get({
        endpoint: insertParams('/superset/search_queries', params),
      });
      setQueriesArray(promise.json);
    } catch (err) {
      actions.addDangerToast(t('An error occurred when refreshing queries'));
    } finally {
      setQueriesLoading(false);
    }
  };
  // functionally this is closest to componentDidMount, though Abramov recommends that it is better if you have a more robust dependency array, though I am afraid that will go into a useCallback loop like before. Though, I could remove some of the refreshQueries in the other methods, and instead have the dependency array focus on when values are changed? That would maybe not play nicely with onChange though.
  useEffect(() => {
    refreshQueries();
<<<<<<< HEAD:superset-frontend/src/SqlLab/components/QuerySearch.tsx
    // eslint-disable-next-line react-hooks/exhaustive-deps
=======
>>>>>>> 3f3c98b7f... switching:superset-frontend/src/SqlLab/components/QuerySearch.jsx
  }, []);

  const onUserClicked = (userId: string) => {
    setUserId(userId);
    refreshQueries();
  };

  const onDbClicked = (dbId: string) => {
    setDatabaseId(dbId);
    refreshQueries();
  };

  const onKeyDown = (event: any) => {
    if (event.keyCode === 13) {
      refreshQueries();
    }
  };

  const userMutator = (data: any) =>
    data.result.map(({ value, text }: userMutatorProps) => ({
      label: text,
      value,
    }));

  const dbMutator = (data: any) => {
    const options = data.result.map((db: any) => ({
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
            onChange={(selected: any) => setUserId(selected?.value)}
            placeholder={t('Filter by user')}
          />
        </div>
        <div className="col-sm-2">
          <AsyncSelect
            onChange={(db: any) => setDatabaseId(db?.value)}
            dataEndpoint="/api/v1/database/?q=(filters:!((col:expose_in_sqllab,opr:eq,value:!t)))"
            value={databaseId}
            mutator={dbMutator}
            placeholder={t('Filter by database')}
          />
        </div>
        <div className="col-sm-4">
          <input
            type="text"
            onChange={debounce(
              (event: any) => setSearchText(event.target.value),
              200,
            )}
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
            value={(from as unknown) as undefined}
            autosize={false}
            onChange={(selected: any) => setFrom(selected?.value)}
          />

          <Select
            name="select-to"
            placeholder={t('[To]-')}
            options={TIME_OPTIONS.map(xt => ({ value: xt, label: xt }))}
            value={(to as unknown) as undefined}
            autosize={false}
            onChange={(selected: any) => setTo(selected?.value)}
          />

          <Select
            name="select-status"
            placeholder={t('Filter by status')}
            options={Object.keys(STATUS_OPTIONS).map(s => ({
              value: s,
              label: s,
            }))}
            value={(status as unknown) as undefined}
            isLoading={false}
            autosize={false}
            onChange={(selected: any) => setStatus(selected?.value)}
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
export default QuerySearch;
