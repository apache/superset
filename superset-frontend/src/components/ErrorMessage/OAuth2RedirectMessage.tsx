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
import { useEffect, useRef, MouseEvent } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { QueryEditor, SqlLabRootState } from 'src/SqlLab/types';
import { ExplorePageState } from 'src/explore/types';
import { RootState } from 'src/dashboard/types';
import { reRunQuery } from 'src/SqlLab/actions/sqlLab';
import { triggerQuery } from 'src/components/Chart/chartAction';
import { onRefresh } from 'src/dashboard/actions/dashboardState';
import { QueryResponse, t } from '@superset-ui/core';

import { ErrorMessageComponentProps } from './types';
import ErrorAlert from './ErrorAlert';

interface OAuth2RedirectExtra {
  url: string;
  tab_id: string;
  redirect_uri: string;
}

/*
 * Component for starting OAuth2 dance.
 *
 * When a user without credentials tries to access a database that supports OAuth2, the
 * backend will raise an exception with the custom error `OAUTH2_REDIRECT`. This will
 * cause the frontend to display this component, which informs the user that they need
 * to authenticate in order to access the data.
 *
 * The component has a URL that is used to start the OAuth2 dance for the given
 * database. When the user clicks the link a new browser tab will open, where they can
 * authorize Superset to access the data. Once authorization is successful the user will
 * be redirected back to Superset, and their personal access token is stored, so it can
 * be used in subsequent connections. If a refresh token is also present in the response,
 * it will also be stored.
 *
 * After the token has been stored, the opened tab will send a message to the original
 * tab and close itself. This component, running on the original tab, will listen for
 * message events, and once it receives the success message from the opened tab it will
 * re-run the query for the user, be it in SQL Lab, Explore, or a dashboard. In order to
 * communicate securely, both tabs share a "tab ID", which is a UUID that is generated
 * by the backend and sent from the opened tab to the original tab. For extra security,
 * we also check that the source of the message is the opened tab via a ref.
 */
function OAuth2RedirectMessage({
  error,
  source,
}: ErrorMessageComponentProps<OAuth2RedirectExtra>) {
  const oAuthTab = useRef<Window | null>(null);
  const { extra, level } = error;

  // store a reference to the OAuth2 browser tab, so we can check that the success
  // message is coming from it
  const handleOAuthClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    oAuthTab.current = window.open(extra.url, '_blank');
  };

  // state needed for re-running the SQL Lab query
  const queries = useSelector<
    SqlLabRootState,
    Record<string, QueryResponse & { inLocalStorage?: boolean }>
  >(state => state.sqlLab.queries);
  const queryEditors = useSelector<SqlLabRootState, QueryEditor[]>(
    state => state.sqlLab.queryEditors,
  );
  const tabHistory = useSelector<SqlLabRootState, string[]>(
    state => state.sqlLab.tabHistory,
  );
  const qe = queryEditors.find(
    qe => qe.id === tabHistory[tabHistory.length - 1],
  );
  const query = qe?.latestQueryId ? queries[qe.latestQueryId] : null;

  // state needed for triggering the chart in Explore
  const chartId = useSelector<ExplorePageState, number | undefined>(
    state => state.explore?.slice?.slice_id,
  );

  // state needed for refreshing dashboard
  const chartList = useSelector<RootState, string[]>(state =>
    Object.keys(state.charts),
  );
  const dashboardId = useSelector<RootState, number | undefined>(
    state => state.dashboardInfo?.id,
  );

  const dispatch = useDispatch();

  useEffect(() => {
    /* Listen for messages from the OAuth2 tab.
     *
     * After OAuth2 is successful the opened tab will send a message before
     * closing itself. Once we receive the message we can retrigger the
     * original query in SQL Lab, explore, or in a dashboard.
     */
    const redirectUrl = new URL(extra.redirect_uri);
    const handleMessage = (event: MessageEvent) => {
      if (
        event.origin === redirectUrl.origin &&
        event.data.tabId === extra.tab_id &&
        event.source === oAuthTab.current
      ) {
        if (source === 'sqllab' && query) {
          dispatch(reRunQuery(query));
        } else if (source === 'explore' && chartId) {
          dispatch(triggerQuery(true, chartId));
        } else if (source === 'dashboard') {
          dispatch(onRefresh(chartList, true, 0, dashboardId));
        }
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [
    source,
    extra.redirect_uri,
    extra.tab_id,
    dispatch,
    query,
    chartId,
    chartList,
    dashboardId,
  ]);

  const body = (
    <p>
      This database uses OAuth2 for authentication. Please click the link above
      to grant Apache Superset permission to access the data. Your personal
      access token will be stored encrypted and used only for queries run by
      you.
    </p>
  );
  const subtitle = (
    <>
      You need to{' '}
      <a
        href={extra.url}
        onClick={handleOAuthClick}
        target="_blank"
        rel="noreferrer"
      >
        provide authorization
      </a>{' '}
      in order to run this operation.
    </>
  );

  return (
    <ErrorAlert
      title={t('Authorization needed')}
      subtitle={subtitle}
      level={level}
      source={source}
      body={body}
    />
  );
}

export default OAuth2RedirectMessage;
