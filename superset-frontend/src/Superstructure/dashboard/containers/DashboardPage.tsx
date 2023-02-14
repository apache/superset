// DODO-changed
import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import Loading from 'src/components/Loading';
import {
  fetchDashboard,
  fetchDashboardCharts,
  fetchDashboardDatasets,
} from 'src/Superstructure/common/hooks/apiResources/';
import { hydrateDashboard } from 'src/dashboard/actions/hydrate';
import { setDatasources } from 'src/dashboard/actions/datasources';
import injectCustomCss from 'src/dashboard/util/injectCustomCss';
import ErrorBoundary from 'src/components/ErrorBoundary';

import DashboardContainer from 'src/Superstructure/dashboard/containers/Dashboard';
import ErrorMessageWithStackTrace from 'src/components/ErrorMessage/ErrorMessageWithStackTrace';

interface DashboardPageProps {
  dashboardIdOrSlug: string;
}

const DashboardPage = ({ dashboardIdOrSlug }: DashboardPageProps) => {
  const dispatch = useDispatch();
  const idOrSlug = dashboardIdOrSlug;

  const [isLoaded, setLoaded] = useState(false);
  const [errorObject, setErrorObject] = useState<any>(null);

  const [dashboardResource, setDashboardResource] = useState<any>(null);
  const [chartsResource, setChartsResource] = useState<any>(null);
  const [datasetsResource, seDatasetsResource] = useState<any>(null);

  const [dashboardResult, setDashboardResult] = useState<any>(null);
  const [chartsResult, setChartsResult] = useState<any>(null);
  const [datasetsResult, seDatasetsResult] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const dashboardResourceResponse = await fetchDashboard(idOrSlug);
        const chartsResourceResponse = await fetchDashboardCharts(idOrSlug);
        const datasetsResourceResponse = await fetchDashboardDatasets(idOrSlug);
        setDashboardResource(dashboardResourceResponse);
        setChartsResource(chartsResourceResponse);
        seDatasetsResource(datasetsResourceResponse);
      } catch (error) {
        console.log('ERROR in DashboardPage.tsx', error);
        setErrorObject({ ...error });
      }
    }
    fetchData();

    // In dodois the div.all has css property min-height, that forces the footer to be overlapped
    const dodoElementAll = document.getElementsByClassName('all')[0];

    if (
      dodoElementAll &&
      !dodoElementAll.classList.contains('overwrite-height')
    ) {
      dodoElementAll.className += ' overwrite-height';
    }
  }, [idOrSlug]);

  useEffect(() => {
    if (dashboardResource && chartsResource && datasetsResource) {
      setDashboardResult(dashboardResource.result);
      setChartsResult(chartsResource.result);
      seDatasetsResult(datasetsResource.result);
    }
  }, [dashboardResource, chartsResource, datasetsResource]);

  useEffect(() => {
    if (dashboardResult && chartsResult && datasetsResult) {
      const dashboard = dashboardResult;
      const charts = chartsResult;
      const datasets = datasetsResult;
      const readyToRender = Boolean(dashboard && charts && datasets);

      if (readyToRender) {
        const dashboardResourceResult = {
          ...dashboard,
          position_data: JSON.parse(dashboard.position_json),
          metadata: JSON.parse(dashboard.json_metadata),
        };

        dispatch(hydrateDashboard(dashboardResourceResult, charts));

        const { dashboard_title, css } = dashboard || {};

        if (dashboard_title) document.title = dashboard_title;

        if (css) injectCustomCss(css);

        dispatch(setDatasources(datasets));
        setLoaded(true);
      }
    }
  }, [dispatch, dashboardResult, chartsResult, datasetsResult]);

  if (errorObject && errorObject.isAxiosError) {
    const {
      response: {
        status = 0,
        data: { msg = 'Unexpected error!' } = {},
        config: { url = 'unknown url' } = {},
      } = {},
    } = errorObject;

    return (
      <ErrorMessageWithStackTrace
        title={msg}
        subtitle={`${url} [status: ${status}]`}
        source="dashboard"
        copyText={`${msg} -> ${url} [status: ${status}]`}
      />
    );
  }

  if (!isLoaded) return <Loading />;

  return <DashboardContainer />;
};

const DashboardPageWithErrorBoundary = ({
  dashboardIdOrSlug,
}: DashboardPageProps) => (
  <ErrorBoundary>
    <DashboardPage dashboardIdOrSlug={dashboardIdOrSlug} />
  </ErrorBoundary>
);
export default DashboardPageWithErrorBoundary;
