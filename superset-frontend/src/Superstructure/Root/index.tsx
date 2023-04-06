/* eslint-disable react-hooks/rules-of-hooks */
import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';

import {
  GlobalError,
  Loading,
  Version,
  ServiceNotAvailable,
} from '../components';
import { MicrofrontendParams, FullConfiguration } from '../types/global';
import { composeAPIConfig } from '../config';

import { store } from '../store';

import LeftNavigation from '../components/LeftNavigation/index';
import Main from '../components/Main/index';

import setupClient from '../setupClient';
import {
  getLoginToken,
  getCsrfToken,
  getDashboardsData,
  dirtyHackDodoIs,
  defineNavigation,
} from './utils';

import {
  RootComponentWrapper,
  DashboardComponentWrapper,
  ContentWrapper,
} from './styles';

import {
  getCoreConfig,
  getNavigationConfig,
  APP_VERSION,
} from '../parseEnvFile/index';
import { serializeValue } from '../parseEnvFile/utils';
import { addSlash, logConfigs } from './helpers';

import '../../theme';

setupClient();

export const RootComponent = (incomingParams: MicrofrontendParams) => {
  const [isLoaded, setLoaded] = useState(false);
  const [isError, setError] = useState(false);
  const [errorObject, setErrorObject] = useState({
    msg: '',
    title: '',
    stackTrace: '',
  });
  const [FULL_CONFIG, setFullConfig] = useState({
    navigation: { showNavigationMenu: false, routes: [] },
    originUrl: '',
    frontendLogger: false,
    basename: '',
  } as FullConfiguration);
  const [isFullConfigReady, setFullConfigReady] = useState(false);

  /**
   * Helper functions
   */
  const handleLoginRequest = async () => {
    const loginResponse = await getLoginToken();
    // await initializeAuth(params);

    if (!loginResponse.loaded) {
      setLoaded(false);
      setError(true);

      if (loginResponse.error) {
        setErrorObject({
          msg: loginResponse.error,
          title: loginResponse.title,
          stackTrace: loginResponse.stackTrace,
        });
      } else {
        setErrorObject({
          msg: 'Проверьте, что в Вашей учетной записи Dodo IS заполнены e-mail, имя и фамилия. При отсутствии этих данных, авторизация в сервисе невозможна',
          title: 'UNEXPECTED_ERROR',
          stackTrace: 'UNKNOWN',
        });
      }
      return null;
    }
    return loginResponse;
  };

  const handleCsrfRequest = async ({ useAuth }: { useAuth: boolean }) => {
    const csrfResponse = await getCsrfToken({ useAuth });

    if (!csrfResponse.loaded) {
      setLoaded(false);
      setError(true);

      if (csrfResponse.error) {
        setErrorObject({
          msg: csrfResponse.error,
          title: csrfResponse.title,
          stackTrace: csrfResponse.stackTrace,
        });
      } else {
        setErrorObject({
          msg: 'Проверьте, что в Вашей учетной записи Dodo IS заполнены e-mail, имя и фамилия. При отсутствии этих данных, авторизация в сервисе невозможна',
          title: 'UNEXPECTED_ERROR',
          stackTrace: 'UNKNOWN',
        });
      }
      return null;
    }

    return csrfResponse;
  };

  const handleDashboardsRequest = async () => {
    const dashboardsResponse = await getDashboardsData();

    if (!dashboardsResponse.loaded) {
      setLoaded(false);
      setError(true);

      if (dashboardsResponse.error) {
        setErrorObject({
          msg: dashboardsResponse.error,
          title: dashboardsResponse.title,
          stackTrace: dashboardsResponse.stackTrace,
        });
      } else {
        setErrorObject({
          msg: 'Что-то пошло не так c получением списка дашбордов',
          title: 'UNEXPECTED_ERROR',
          stackTrace: 'UNKNOWN',
        });
      }
      return null;
    }
    return dashboardsResponse;
  };

  dirtyHackDodoIs();

  const CONFIG = getCoreConfig(
    process.env.WEBPACK_MODE as 'development' | 'production' | 'none',
  );

  const params = useMemo(() => {
    const parameters = { ...incomingParams, ...CONFIG };
    const basename = addSlash(parameters.basename);

    return {
      ...parameters,
      basename,
    };
  }, [incomingParams]);

  const IS_UNAVAILABLE = serializeValue(process.env.isUnavailable) === 'true';

  if (IS_UNAVAILABLE) {
    return <ServiceNotAvailable />;
  }

  useEffect(() => {
    composeAPIConfig(params);
  }, [params]);

  useEffect(() => {
    const initializeLoginAndMenu = async () => {
      let isLoginSkipped = false;
      let useAuth = false;

      if (process.env.WEBPACK_MODE === 'development') {
        isLoginSkipped = false;
        useAuth = true;
      }
      if (process.env.WEBPACK_MODE === 'production') {
        // On production we do not need to take acceess token
        isLoginSkipped = true;
        // On production we do not have acceess token, so we get csrf without a token
        useAuth = false;
      }

      const login = await handleLoginRequest();

      if (isLoginSkipped || (login && login.data && login.data.access_token)) {
        const csrf = await handleCsrfRequest({ useAuth });

        if (csrf && csrf.data && csrf.data.result) {
          const dashboards = await handleDashboardsRequest();

          if (dashboards && dashboards.data) {
            const navConfigFull = getNavigationConfig(
              defineNavigation(dashboards.data),
            );

            if (navConfigFull && navConfigFull.navigation.routes.length) {
              setLoaded(true);

              const { basename, originUrl, frontendLogger } = params;
              setFullConfig({
                ...navConfigFull,
                basename,
                originUrl,
                frontendLogger,
              });
              setFullConfigReady(true);
            } else {
              setLoaded(false);
              setError(true);
              setErrorObject({
                msg: 'Что-то пошло не так c настройкой меню',
                title: 'UNEXPECTED_ERROR',
                stackTrace: 'UNKNOWN',
              });
            }
          }
        }
      }
    };

    initializeLoginAndMenu();
  }, [params]);

  logConfigs(FULL_CONFIG, incomingParams, params);

  if (isError) {
    return (
      <>
        <Version appVersion={APP_VERSION} />
        <GlobalError
          title={errorObject.title}
          body={errorObject.msg}
          stackTrace={errorObject.stackTrace}
        />
      </>
    );
  }

  return (
    <div>
      <Version appVersion={APP_VERSION} />
      <ContentWrapper>
        {!isLoaded || !isFullConfigReady ? (
          <Loading />
        ) : (
          <RootComponentWrapper
            withNavigation={FULL_CONFIG.navigation.showNavigationMenu}
          >
            <Router>
              <LeftNavigation
                routesConfig={FULL_CONFIG.navigation.routes}
                baseRoute={FULL_CONFIG.basename}
              />
              <DashboardComponentWrapper
                withNavigation={FULL_CONFIG.navigation.showNavigationMenu}
              >
                <Main
                  navigation={FULL_CONFIG.navigation}
                  store={store}
                  basename={FULL_CONFIG.basename}
                />
              </DashboardComponentWrapper>
            </Router>
          </RootComponentWrapper>
        )}
      </ContentWrapper>
    </div>
  );
};
