/* eslint-disable react-hooks/rules-of-hooks */
import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';

import {
  GlobalError,
  Loading,
  Version,
  ServiceNotAvailable,
} from '../components';
import {
  MicrofrontendParams,
  FullConfiguration,
  Dashboard,
} from '../types/global';
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

import { getNavigationConfig, APP_VERSION } from '../parseEnvFile/index';
import { serializeValue } from '../parseEnvFile/utils';
import { addSlash, logConfigs } from './helpers';

import '../../theme';
import {
  MESSAGES,
  KNOWN_CERTIFIED_BY,
  KNOWN_CERTIFICATAION_DETAILS,
} from '../constants';

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

    const validCertifiedBy = (cert_by: string | null) =>
      cert_by && KNOWN_CERTIFIED_BY.indexOf(cert_by) >= 0;

    const validCertificationDetails = (cert_details: string | null) =>
      cert_details && KNOWN_CERTIFICATAION_DETAILS.indexOf(cert_details) >= 0;

    const filteredDashboards =
      dashboardsResponse.data &&
      dashboardsResponse.data.filter(
        (dashboard: Dashboard) =>
          dashboard.certified_by && dashboard.certification_details,
      );

    if (!filteredDashboards?.length) {
      setLoaded(false);
      setError(true);
      setErrorObject({
        msg: MESSAGES.GET_MENU.NO_DASHBOARDS,
        title: dashboardsResponse.title,
        stackTrace: dashboardsResponse.stackTrace,
      });

      return null;
    }

    const validatedDashboards = filteredDashboards?.filter(
      (dashboard: Dashboard) =>
        validCertifiedBy(dashboard.certified_by) &&
        validCertificationDetails(dashboard.certification_details),
    );

    if (!validatedDashboards?.length) {
      setLoaded(false);
      setError(true);
      setErrorObject({
        msg: MESSAGES.GET_MENU.NOT_VALID_CERTIFICATION,
        title: dashboardsResponse.title,
        stackTrace: dashboardsResponse.stackTrace,
      });

      return null;
    }

    const alteredDashboardResponse = {
      ...dashboardsResponse,
      data: validatedDashboards,
    };

    console.group('Dashboards:');
    console.log('Before validation', dashboardsResponse.data);
    console.log('After validation', alteredDashboardResponse);
    console.groupEnd();

    if (!alteredDashboardResponse.data?.length) {
      setLoaded(false);
      setError(true);
      setErrorObject({
        msg: MESSAGES.GET_MENU.NO_DASHBOARDS,
        title: dashboardsResponse.title,
        stackTrace: dashboardsResponse.stackTrace,
      });

      return null;
    }

    return alteredDashboardResponse;
  };

  dirtyHackDodoIs();

  const params: {
    originUrl: string;
    token: string;
    basename: string;
    frontendLogger: boolean;
  } = useMemo(() => {
    const env = process.env.WEBPACK_MODE;

    let parameters = {
      originUrl:
        incomingParams.originUrl || `${window.location.origin}/superset`,
      token: incomingParams.token || '',
      basename: incomingParams.basename
        ? addSlash(incomingParams.basename)
        : '/',
      frontendLogger: incomingParams.frontendLogger || true,
    };

    // Superset API works only with port 3000
    if (env === 'development') {
      parameters = {
        ...parameters,
        basename: '/',
        originUrl: 'https://superset.dodois.dev',
        frontendLogger: true,
      };
    }
    console.log('Incoming Parameters: ', incomingParams);
    console.log('Checked and altered parameters: ', parameters);

    return parameters;
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
      let login = null;

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

      if (!isLoginSkipped) login = await handleLoginRequest();

      if (
        isLoginSkipped ||
        (!isLoginSkipped && login && login.data && login.data.access_token)
      ) {
        const csrf = await handleCsrfRequest({ useAuth });

        if (csrf && csrf.data && csrf.data.result) {
          const dashboards = await handleDashboardsRequest();

          if (dashboards && dashboards.data && dashboards.data.length) {
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
