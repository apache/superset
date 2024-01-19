import React from 'react';
import { Switch, Route, Redirect } from 'react-router-dom';
import AnalyticsMain from '../MainRoute/index';
import DashboardApp from '../App';
import { MainComponentProps } from '../../types/global';

export default function Main({
  navigation,
  store,
  basename,
  stylesConfig,
  annotationMessages,
}: MainComponentProps) {
  window.featureFlags = {
    ...window.featureFlags,
    DYNAMIC_PLUGINS: false,
  };

  return navigation ? (
    <>
      <Switch>
        {navigation.routes.map((mappedRoute, index) => {
          if (mappedRoute.isMainRoute) {
            return (
              <Route
                key={`${mappedRoute.idOrSlug}-${index}`}
                path={`${basename}Main`}
              >
                <AnalyticsMain
                  stylesConfig={stylesConfig}
                  annotationMessages={annotationMessages}
                />
              </Route>
            );
          }
          return (
            <Route
              key={`${mappedRoute.idOrSlug}-${index}`}
              path={`${basename}${mappedRoute.idOrSlug}`}
            >
              <DashboardApp
                store={store}
                dashboardIdOrSlug={mappedRoute.idOrSlug}
              />
            </Route>
          );
        })}
        <Redirect to={`${basename}Main`} />
      </Switch>
    </>
  ) : (
    <div>There is no navigation defined</div>
  );
}
