import React from 'react';
import { Switch, Route, Redirect } from 'react-router-dom';

import { getDashboardIdOrSlug } from 'src/Superstructure/utils/routesUtils';

import DashboardApp from 'src/Superstructure/components/App';
import { getNavigationConfig } from 'src/Superstructure/parseEnvFile/index';

import AnalyticsMain from 'src/Superstructure/components/MainRoute/index';
import { MainComponentProps } from 'src/Superstructure/types/global';

export default function Routes({
  navigation,
  store,
  basename,
}: MainComponentProps) {
  const NAVIGATION_CONFIG = getNavigationConfig();

  console.log('Routes NAVIGATION_CONFIG', NAVIGATION_CONFIG);

  return navigation ? (
    <Switch>
      {navigation.routes.map(mappedRoute => {
        if (mappedRoute.route === NAVIGATION_CONFIG.navigation.main) {
          return (
            <Route
              // @ts-ignore
              key={mappedRoute.idOrSlug}
              path={`${basename}${navigation.routesObject.Main.route}`}
            >
              <AnalyticsMain />
            </Route>
          );
        }
        return (
          <Route
            // @ts-ignore
            key={mappedRoute.idOrSlug}
            path={`${basename}${mappedRoute.route}`}
          >
            <DashboardApp
              store={store}
              dashboardIdOrSlug={getDashboardIdOrSlug({
                navigation,
                route: mappedRoute.route,
              })}
            />
          </Route>
        );
      })}
      <Redirect to={`${basename}${navigation.routesObject.Main.route}`} />
    </Switch>
  ) : (
    <div>There is no navigation defined (dev routes)</div>
  );
}
