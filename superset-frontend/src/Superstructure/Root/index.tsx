/* eslint-disable react-hooks/rules-of-hooks */
import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';

import {
  GlobalError,
  Loading,
  Version,
  ServiceNotAvailable,
} from 'src/Superstructure/components';
import { MicrofrontendParams } from 'src/Superstructure/types/global';
import { composeAPIConfig } from 'src/Superstructure/config';

import { theme } from 'src/preamble';
import { store } from 'src/Superstructure/store';

import LeftNavigation from 'src/Superstructure/components/LeftNavigation/index';
import Main from 'src/Superstructure/components/Main/index';

import setupClient from 'src/Superstructure/setupClient';
import { initializeAuth, addSlash, logConfigs } from 'src/Superstructure/Root/utils';

import {
  getFullConfig,
  getNavigationConfig,
  APP_VERSION,
} from 'src/Superstructure/parseEnvFile/index';
import {
  RootComponentWrapper,
  DashboardComponentWrapper,
} from 'src/Superstructure/Root/styles';
import { serializeValue } from 'src/Superstructure/parseEnvFile/utils';


// import '../../preamble';

const NAV_CONFIG = getNavigationConfig();

const CONFIG = getFullConfig(
  process.env.WEBPACK_MODE as 'development' | 'production' | 'none',
  NAV_CONFIG,
);

setupClient();

export const RootComponent = (incomingParams: MicrofrontendParams) => {
  const params = useMemo(() => {
    const parameters = { ...incomingParams, ...CONFIG };
    const basename = addSlash(parameters.basename);

    return {
      ...parameters,
      basename,
    };
  }, [incomingParams]);

  logConfigs(CONFIG, incomingParams, params);

  const IS_UNAVAILABLE = serializeValue(process.env.isUnavailable) === 'true';

  if (IS_UNAVAILABLE) {
    return <ServiceNotAvailable />;
  }

  const [isLoaded, setLoaded] = useState(false);
  const [isError, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    composeAPIConfig(params);
  }, [params]);

  useEffect(() => {
    const performInitilizeAuth = async () => {
      const { loaded, error, errorMsg } = await initializeAuth(params);
      if (loaded) setLoaded(true);

      if (error) {
        setLoaded(false);
        setError(true);
        setErrorMessage(errorMsg);
      }
    };

    performInitilizeAuth();
  }, [params]);

  const { navigation, basename } = params;

  const useNavigationMenu = navigation?.showNavigationMenu;

  return (
    <>
      {isError ? (
        <div>
          <Version appVersion={APP_VERSION} />
          <GlobalError
            title="Error happened =("
            body={`${errorMessage}`}
            stackTrace="Проверьте, что в Вашей учетной записи Dodo IS заполнены e-mail, имя и фамилия. При отсутствии этих данных, авторизация в сервисе невозможна."
          />
        </div>
      ) : !isLoaded ? (
        <Loading />
      ) : isLoaded && navigation && basename ? (
        <RootComponentWrapper withNavigation={useNavigationMenu}>
          {useNavigationMenu && navigation && navigation.main ? (
            <Router>
              <LeftNavigation
                routesConfig={navigation.routes}
                baseRoute={basename}
              />
              <DashboardComponentWrapper withNavigation={useNavigationMenu}>
                <Version appVersion={APP_VERSION} />
                <Main
                  navigation={navigation}
                  store={store}
                  theme={theme}
                  basename={basename}
                />
              </DashboardComponentWrapper>
            </Router>
          ) : (
            <GlobalError
              title="Error happened =("
              body="There is no dashboard ID or slug provided."
              stackTrace="Either provide dashboard ID or slug or enable navigation via useNavigationMenu flag"
            />
          )}
        </RootComponentWrapper>
      ) : (
        isLoaded &&
        (!navigation || !basename) && (
          <div>
            <Version appVersion={APP_VERSION} />
            <GlobalError
              title="Error happened =("
              body="There is no navigation object or basename provided"
              stackTrace="Provide navigation object and|or basename"
            />
          </div>
        )
      )}
    </>
  );
};
