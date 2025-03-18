// DODO was here
import { Suspense, useEffect, useState } from 'react';
import { hot } from 'react-hot-loader/root';
import {
  BrowserRouter as Router,
  Switch,
  Route,
  useLocation,
} from 'react-router-dom';
import { bindActionCreators } from 'redux';
import { GlobalStyles } from 'src/GlobalStyles';
import ErrorBoundary from 'src/components/ErrorBoundary';
import Loading from 'src/components/Loading';
import Menu from 'src/features/home/Menu';
import getBootstrapData from 'src/utils/getBootstrapData';
import ToastContainer from 'src/components/MessageToasts/ToastContainer';
import setupApp from 'src/setup/setupApp';
import setupPlugins from 'src/setup/setupPlugins';
import { routes, isFrontendRoute } from 'src/views/routes';
import { Logger, LOG_ACTIONS_SPA_NAVIGATION } from 'src/logger/LogUtils';
import setupExtensions from 'src/setup/setupExtensions';
import { logEvent } from 'src/logger/actions';
import { store } from 'src/views/store';
import { OnBoardingEntryPoint } from 'src/DodoExtensions/onBoarding'; // DODO added 44211792
import ErrorMessage from 'src/DodoExtensions/components/ErrorMessage'; // DODO added 47383817
import { RootContextProviders } from './RootContextProviders';
import { ScrollToTop } from './ScrollToTop';

setupApp();
setupPlugins();
setupExtensions();

const bootstrapData = getBootstrapData();

let lastLocationPathname: string;

const boundActions = bindActionCreators({ logEvent }, store.dispatch);

const LocationPathnameLogger = () => {
  const location = useLocation();
  useEffect(() => {
    // This will log client side route changes for single page app user navigation
    boundActions.logEvent(LOG_ACTIONS_SPA_NAVIGATION, {
      path: location.pathname,
    });
    // reset performance logger timer start point to avoid soft navigation
    // cause dashboard perf measurement problem
    if (lastLocationPathname && lastLocationPathname !== location.pathname) {
      Logger.markTimeOrigin();
    }
    lastLocationPathname = location.pathname;
  }, [location.pathname]);
  return <></>;
};

// DODO added 47383817
const Content = () => {
  const [connectionError, setConnectionError] = useState(false);
  return (
    <>
      <Menu
        data={bootstrapData.common.menu_data}
        isFrontendRoute={isFrontendRoute}
        connectionError={connectionError}
        setConnectionError={setConnectionError}
      />
      {!connectionError && (
        <>
          <Switch>
            {routes.map(
              ({ path, Component, props = {}, Fallback = Loading }) => (
                <Route path={path} key={path}>
                  <Suspense fallback={<Fallback />}>
                    <ErrorBoundary>
                      <Component user={bootstrapData.user} {...props} />
                    </ErrorBoundary>
                  </Suspense>
                </Route>
              ),
            )}
          </Switch>

          {/* DODO added 44211792 */}
          <OnBoardingEntryPoint />

          <ToastContainer />
        </>
      )}

      {connectionError && <ErrorMessage />}
    </>
  );
};

const App = () => (
  <Router>
    <ScrollToTop />
    <LocationPathnameLogger />
    <RootContextProviders>
      <GlobalStyles />
      <Content />
    </RootContextProviders>
  </Router>
);

export default hot(App);
