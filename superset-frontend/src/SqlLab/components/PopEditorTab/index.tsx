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
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import URI from 'urijs';
import { pick } from 'lodash';
import { useComponentDidUpdate } from '@superset-ui/core';
import { Skeleton } from '@superset-ui/core/components';
import useEffectEvent from 'src/hooks/useEffectEvent';
import { useLocationState } from 'src/pages/SqlLab/LocationContext';
import {
  addNewQueryEditor,
  addQueryEditor,
  popDatasourceQuery,
  popPermalink,
  popQuery,
  popSavedQuery,
  popStoredQuery,
} from 'src/SqlLab/actions/sqlLab';
import { SqlLabRootState } from 'src/SqlLab/types';
import { navigateWithState } from 'src/utils/navigationUtils';
import getBootstrapData from 'src/utils/getBootstrapData';

const SQL_LAB_URL = '/sqllab';

const PopEditorTab: React.FC = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [queryEditorId, setQueryEditorId] = useState<string>();
  const { requestedQuery } = useLocationState();
  const activeQueryEditorId = useSelector<SqlLabRootState, string>(
    ({ sqlLab: { tabHistory } }) => tabHistory.slice(-1)[0],
  );
  const [updatedUrl, setUpdatedUrl] = useState<string>(SQL_LAB_URL);
  const dispatch = useDispatch();
  useComponentDidUpdate(() => {
    setQueryEditorId(assigned => assigned ?? activeQueryEditorId);
    if (activeQueryEditorId) {
      navigateWithState(updatedUrl, {}, { replace: true });
    }
  }, [activeQueryEditorId]);

  const popSqlEditor = useEffectEvent(() => {
    const bootstrapData = getBootstrapData();
    const {
      id = undefined,
      name = undefined,
      sql = undefined,
      savedQueryId = undefined,
      datasourceKey = undefined,
      queryId = undefined,
      dbid = 0,
      catalog = undefined,
      schema = undefined,
      autorun = false,
      permalink = undefined,
      new: isNewQuery = undefined,
      ...restUrlParams
    } = {
      ...requestedQuery,
      ...bootstrapData.requested_query,
    };

    // Popping a new tab based on the querystring
    if (permalink || id || sql || savedQueryId || datasourceKey || queryId) {
      setIsLoading(true);
      const targetUrl = `${URI(SQL_LAB_URL).query(pick(requestedQuery, Object.keys(restUrlParams)))}`;
      setUpdatedUrl(targetUrl);
      if (permalink) {
        dispatch(popPermalink(permalink));
      } else if (id) {
        dispatch(popStoredQuery(id));
      } else if (savedQueryId) {
        dispatch(popSavedQuery(savedQueryId));
      } else if (queryId) {
        dispatch(popQuery(queryId));
      } else if (datasourceKey) {
        dispatch(popDatasourceQuery(datasourceKey, sql));
      } else if (sql) {
        const newQueryEditor = {
          name,
          dbId: Number(dbid),
          catalog,
          schema,
          autorun,
          sql,
        };
        dispatch(addQueryEditor(newQueryEditor));
      }
    } else if (isNewQuery) {
      setIsLoading(true);
      dispatch(addNewQueryEditor());
    }
  });

  useEffect(() => {
    popSqlEditor();
  }, [popSqlEditor]);

  if (isLoading && !queryEditorId) {
    return <Skeleton active />;
  }

  return <>{children}</>;
};

export default PopEditorTab;
