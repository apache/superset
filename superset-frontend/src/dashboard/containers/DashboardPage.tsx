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
import React, { useEffect, FC } from 'react';
import { t } from '@superset-ui/core';
import { useDispatch } from 'react-redux';
import { useParams } from 'react-router-dom';
import { useToasts } from 'src/messageToasts/enhancers/withToasts';
import Loading from 'src/components/Loading';
import {
  useDashboard,
  useDashboardCharts,
  useDashboardDatasets,
} from 'src/common/hooks/apiResources';
import { hydrateDashboard } from 'src/dashboard/actions/hydrate';
import { setDatasources } from 'src/dashboard/actions/datasources';
import injectCustomCss from 'src/dashboard/util/injectCustomCss';
import setupPlugins from 'src/setup/setupPlugins';

setupPlugins();
const DashboardContainer = React.lazy(
  () =>
    import(
      /* webpackChunkName: "DashboardContainer" */
      /* webpackPreload: true */
      'src/dashboard/containers/Dashboard'
    ),
);

const originalDocumentTitle = document.title;

const DashboardPage: FC = () => {
  const dispatch = useDispatch();
  const { addDangerToast } = useToasts();
  const { idOrSlug } = useParams<{ idOrSlug: string }>();
  const { result: dashboard, error: dashboardApiError } = useDashboard(
    idOrSlug,
  );
  const { result: charts, error: chartsApiError } = useDashboardCharts(
    idOrSlug,
  );
  const { result: datasets, error: datasetsApiError } = useDashboardDatasets(
    idOrSlug,
  );

  const error = dashboardApiError || chartsApiError;
  const readyToRender = Boolean(dashboard && charts);
  const { dashboard_title, css } = dashboard || {};

  useEffect(() => {
    if (readyToRender) {
      dispatch(hydrateDashboard(dashboard, charts));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyToRender]);

  useEffect(() => {
    if (dashboard_title) {
      document.title = dashboard_title;
    }
    return () => {
      document.title = originalDocumentTitle;
    };
  }, [dashboard_title]);

  useEffect(() => {
    if (css) {
      // returning will clean up custom css
      // when dashboard unmounts or changes
      return injectCustomCss(css);
    }
    return () => {};
  }, [css]);

  useEffect(() => {
    if (datasetsApiError) {
      addDangerToast(
        t('Error loading chart datasources. Filters may not work correctly.'),
      );
    } else {
      dispatch(setDatasources(datasets));
    }
  }, [addDangerToast, datasets, datasetsApiError, dispatch]);

  if (error) throw error; // caught in error boundary
  if (!readyToRender) return <Loading />;

  return <DashboardContainer />;
};

export default DashboardPage;
