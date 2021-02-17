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
import { SupersetClient, getClientErrorObject } from '@superset-ui/core';
import setBootstrapData from 'src/dashboard/actions/bootstrapData';
import Loading from 'src/components/Loading';
import getInitialState from '../reducers/getInitialState';

interface DashboardRouteProps {
  actions: {
    setBootstrapData: (arg0: object) => void;
  };
  dashboardId: string;
}
const DashboardRoute: FC<DashboardRouteProps> = ({
  children,
  actions,
  dashboardId,
}) => {
  const appContainer = document.getElementById('app');
  const bootstrapData = appContainer?.getAttribute('data-bootstrap');
  const bootstrapDataJson = JSON.parse(bootstrapData || '');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    SupersetClient.get({ endpoint: `/api/v1/dashboard/${dashboardId}/charts` })
      .then(r => {
        const initState = getInitialState(bootstrapDataJson, r.json.result);
        actions.setBootstrapData(initState);
        setLoaded(true);
      })
      .catch(err => {
        console.log('err', err);
      });
  }, []);
  if (!loaded) return <Loading />;
  return <>{children} </>;
};

function mapDispatchToProps(dispatch: Dispatch<AnyAction>) {
  return {
    actions: bindActionCreators(
      {
        setBootstrapData,
      },
      dispatch,
    ),
  };
}

export default connect(null, mapDispatchToProps)(DashboardRoute);
