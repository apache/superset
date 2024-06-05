import React from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import DashboardApp from '../App';
import { MainComponentProps } from '../../types/global';

export default function Main({
  navigation,
  store,
  basename,
  startDashboardId = 0,
}: MainComponentProps) {
  window.featureFlags = {
    ...window.featureFlags,
    DYNAMIC_PLUGINS: false,
    GLOBAL_ASYNC_QUERIES: true,
    // DYNAMIC_PLUGINS: true,
    DASHBOARD_NATIVE_FILTERS: true,
    DASHBOARD_CROSS_FILTERS: true,
    DASHBOARD_NATIVE_FILTERS_SET: false,
    TAGGING_SYSTEM: false,
  };

  return navigation ? (
    <>
      <Switch>
        {navigation.routes.map((mappedRoute, index) => (
          <Route
            key={`${mappedRoute.idOrSlug}-${index}`}
            path={`${basename}${mappedRoute.idOrSlug}`}
          >
            <DashboardApp
              store={store}
              dashboardIdOrSlug={mappedRoute.idOrSlug}
            />
          </Route>
        ))}
        <Redirect to={`${basename}${startDashboardId}`} />
      </Switch>
    </>
  ) : (
    <div>There is no navigation defined</div>
  );
}
