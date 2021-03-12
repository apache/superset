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
import React, { useEffect, useState, FC } from 'react';
import { connect } from 'react-redux';
import { AnyAction, bindActionCreators, Dispatch } from 'redux';
import { SupersetClient } from '@superset-ui/core';
import Loading from 'src/components/Loading';
import ErrorBoundary from 'src/components/ErrorBoundary';
import { bootstrapDashboardState } from '../actions/bootstrapData';

interface DashboardRouteProps {
  actions: {
    bootstrapDashboardState: typeof bootstrapDashboardState;
  };
  dashboardIdOrSlug: string;
}
const getData = (idOrSlug: string) => {
  const batch = [
    SupersetClient.get({ endpoint: `/api/v1/dashboard/${idOrSlug}` }),
    SupersetClient.get({ endpoint: `/api/v1/dashboard/${idOrSlug}/charts` }),
    SupersetClient.get({ endpoint: `/api/v1/dashboard/${idOrSlug}/datasets` }),
  ];
  return Promise.all(batch).then(([dashboardRes, chartRes, datasetRes]) => ({
    dashboard: dashboardRes.json.result,
    charts: chartRes.json.result,
    datasets: datasetRes.json.result,
  }));
};

const DashboardRoute: FC<DashboardRouteProps> = ({
  children,
  actions,
  dashboardIdOrSlug, // eventually get from react router
}) => {
  const [loaded, setLoaded] = useState(false);

  const handleError = (error: unknown) => ({ error, info: null });

  useEffect(() => {
    setLoaded(false);
    getData(dashboardIdOrSlug)
      .then(data => {
        if (data) {
          actions.bootstrapDashboardState(
            data.datasets,
            data.charts,
            data.dashboard,
          );
          setLoaded(true);
        }
      })
      .catch(err => {
        setLoaded(true);
        handleError(err);
      });
  }, [dashboardIdOrSlug, actions]);

  if (!loaded) return <Loading />;
  return <ErrorBoundary onError={handleError}>{children} </ErrorBoundary>;
};

function mapDispatchToProps(dispatch: Dispatch<AnyAction>) {
  return {
    actions: bindActionCreators(
      {
        bootstrapDashboardState,
      },
      dispatch,
    ),
  };
}

export default connect(null, mapDispatchToProps)(DashboardRoute);
