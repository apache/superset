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
import { useDispatch } from 'react-redux';
import { useParams } from 'react-router-dom';
import Loading from 'src/components/Loading';
import {
  useDashboard,
  useDashboardCharts,
  useDashboardDatasets,
} from 'src/common/hooks/apiResources';
import { ResourceStatus } from 'src/common/hooks/apiResources/apiResources';
import { hydrateDashboard } from 'src/dashboard/actions/hydrate';
import injectCustomCss from 'src/dashboard/util/injectCustomCss';

const DashboardContainer = React.lazy(
  () =>
    import(
      /* webpackChunkName: "DashboardContainer" */
      /* webpackPreload: true */
      'src/dashboard/containers/Dashboard'
    ),
);

const DashboardPage: FC = () => {
  const dispatch = useDispatch();
  const { idOrSlug } = useParams<{ idOrSlug: string }>();
  const [isHydrated, setHydrated] = useState(false);
  const dashboardResource = useDashboard(idOrSlug);
  const chartsResource = useDashboardCharts(idOrSlug);
  const datasetsResource = useDashboardDatasets(idOrSlug);
  const error = [dashboardResource, chartsResource, datasetsResource].find(
    resource => resource.status === ResourceStatus.ERROR,
  )?.error;

  useEffect(() => {
    if (dashboardResource.result) {
      document.title = dashboardResource.result.dashboard_title;
      if (dashboardResource.result.css) {
        // returning will clean up custom css
        // when dashboard unmounts or changes
        return injectCustomCss(dashboardResource.result.css);
      }
    }
    return () => {};
  }, [dashboardResource.result]);

  const shouldBeHydrated =
    dashboardResource.status === ResourceStatus.COMPLETE &&
    chartsResource.status === ResourceStatus.COMPLETE &&
    datasetsResource.status === ResourceStatus.COMPLETE;

  useEffect(() => {
    if (shouldBeHydrated) {
      dispatch(
        hydrateDashboard(
          dashboardResource.result,
          chartsResource.result,
          datasetsResource.result,
        ),
      );
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldBeHydrated]);

  if (error) throw error; // caught in error boundary
  if (!isHydrated) return <Loading />;
  return <DashboardContainer />;
};

export default DashboardPage;
