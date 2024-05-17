/* eslint-disable react-hooks/rules-of-hooks */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { styled } from '@superset-ui/core';

import Icons from 'src/components/Icons';

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
  AnnotationLayer,
  SingleAnnotation,
  InitializedResponse,
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
  getAnnotationLayersData,
  getSingleAnnotationLayerIdsData,
  getSingleAnnotationData,
  dirtyHackDodoIs,
  defineNavigation,
  sortDashboards,
  validCertifiedBy,
  validCertificationDetails,
} from './utils';

import {
  RootComponentWrapper,
  DashboardComponentWrapper,
  ContentWrapper,
} from './styles';

import { getNavigationConfig, APP_VERSION } from '../parseEnvFile';
import { serializeValue } from '../parseEnvFile/utils';
import { addSlash, logConfigs } from './helpers';

import '../../theme';
import {
  MESSAGES,
  STYLES_DODOPIZZA,
  STYLES_DRINKIT,
  STYLES_DONER42,
  ALERT_PREFIX,
  SORTING_PREFIX,
} from '../constants';

setupClient();

export const RootComponent = (incomingParams: MicrofrontendParams) => {
  // TODO: DODO: duplicated logic in src/Superstructure/store.ts
  function getPageLanguage(): string | null {
    if (!document) {
      return null;
    }
    const select: HTMLSelectElement | null = document.querySelector(
      '#changeLanguage select',
    );
    const selectedLanguage = select ? select.value : null;
    return selectedLanguage;
  }

  const getLocaleForSuperset = () => {
    const dodoisLanguage = getPageLanguage();
    if (dodoisLanguage) {
      if (dodoisLanguage === 'ru-RU') return 'ru';
      return 'en';
    }
    return 'ru';
  };

  const userLanguage = getLocaleForSuperset();

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
  const [stylesConfig, setStylesConfig] = useState(STYLES_DODOPIZZA);
  const [annotationsObjects, setAnnotationsObjects] = useState(null) as any;

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

  const handleAnnotationLayersRequest = async () => {
    const annotationsResponse = await getAnnotationLayersData();

    if (annotationsResponse.loaded && annotationsResponse.data) {
      const filteredAnnotationLayers = annotationsResponse.data.filter(
        (layer: AnnotationLayer) => layer.name.includes(ALERT_PREFIX),
      );

      const foundAnnotationLayer = filteredAnnotationLayers[0] || null;

      if (foundAnnotationLayer) {
        const idsResponse = await getSingleAnnotationLayerIdsData(
          foundAnnotationLayer.id,
        );

        if (
          idsResponse?.loaded &&
          idsResponse.data?.ids &&
          idsResponse.data?.ids.length
        ) {
          const dataWithIds = {
            layerId: idsResponse.data.layerId,
            ids: idsResponse.data.ids,
          };

          return dataWithIds;
        }

        return null;
      }

      return null;
    }

    return null;
  };

  const handleAnnotationLayersRequestSorting = async () => {
    const annotationsResponse = await getAnnotationLayersData();

    if (annotationsResponse.loaded && annotationsResponse.data) {
      const filteredAnnotationLayers = annotationsResponse.data.filter(
        (layer: AnnotationLayer) => layer.name.includes(SORTING_PREFIX),
      );

      const foundAnnotationLayer = filteredAnnotationLayers[0] || null;

      if (foundAnnotationLayer) {
        const idsResponse = await getSingleAnnotationLayerIdsData(
          foundAnnotationLayer.id,
        );

        if (
          idsResponse?.loaded &&
          idsResponse.data?.ids &&
          idsResponse.data?.ids.length
        ) {
          const dataWithIds = {
            layerId: idsResponse.data.layerId,
            ids: idsResponse.data.ids,
          };

          return dataWithIds;
        }

        return null;
      }

      return null;
    }

    return null;
  };

  const handleAnnotationsRequest = async ({
    layerId,
    ids,
  }: {
    layerId: number;
    ids: number[];
  }): Promise<InitializedResponse<{ result: SingleAnnotation } | null>[]> =>
    Promise.all(
      ids.map(
        async (
          id,
        ): Promise<InitializedResponse<{ result: SingleAnnotation } | null>> =>
          getSingleAnnotationData(layerId, id),
      ),
    );

  const handleDashboardsRequest = async (business: string) => {
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

    const filteredDashboards = dashboardsResponse.data?.filter(
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

    const validatedDashboards = filteredDashboards
      ?.filter(
        (dashboard: Dashboard) =>
          validCertifiedBy(business, dashboard.certified_by) &&
          validCertificationDetails(dashboard.certification_details),
      )
      .sort((dashboardA, dashboardB) => dashboardA.id - dashboardB.id);

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

    console.groupCollapsed('Dashboards:');
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
    business: string;
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
      business: incomingParams.businessId || 'dodopizza',
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
    if (params.business === 'drinkit') setStylesConfig(STYLES_DRINKIT);
    else if (params.business === 'doner42') setStylesConfig(STYLES_DONER42);
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

        if (csrf?.data?.result) {
          const dashboards = await handleDashboardsRequest(params.business);

          const annotationIds = await handleAnnotationLayersRequest();
          if (annotationIds) {
            const annotations = await handleAnnotationsRequest(annotationIds);
            if (annotations?.length) {
              const filteredAnnotations = annotations.filter(annotation =>
                annotation?.data?.result.short_descr.includes(ALERT_PREFIX),
              );
              setAnnotationsObjects(filteredAnnotations);
            }
          }

          if (dashboards?.data?.length) {
            let SORTING_IDS = [] as any[];

            const sortingAnnotationIds =
              await handleAnnotationLayersRequestSorting();

            if (sortingAnnotationIds) {
              const annotations = await handleAnnotationsRequest(
                sortingAnnotationIds,
              );

              if (annotations?.length) {
                const filteredSortingAnnotations = annotations.filter(
                  annotation =>
                    annotation?.data?.result.short_descr.includes(
                      SORTING_PREFIX,
                    ),
                );
                const jsonObjectString = !filteredSortingAnnotations.length
                  ? '{}'
                  : filteredSortingAnnotations[0]?.data?.result.json_metadata;

                if (jsonObjectString) {
                  SORTING_IDS = JSON.parse(jsonObjectString)?.order || [];
                }
              }
            }

            const navConfigFull = getNavigationConfig(
              sortDashboards(
                defineNavigation(dashboards.data),
                SORTING_IDS || [],
              ),
            );

            if (navConfigFull?.navigation.routes.length) {
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
  const [isVisible, setIsVisible] = useState(true);

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
  const StyledCollapseBtn = styled.button<{
    isVisible: boolean;
  }>`
    color: ${({ isVisible }) => (isVisible ? 'initial' : '#ff6900')};
    background: none;
    border: none;
    position: relative;
    padding-top: 8px;
  `;

  const closeLeftNavigation = useCallback(() => setIsVisible(false), []); // DODO added #33605679

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
                stylesConfig={stylesConfig}
                language={userLanguage}
                isVisible={isVisible}
                onNavigate={closeLeftNavigation} // DODO added #33605679
              />
              <DashboardComponentWrapper
                withNavigation={
                  FULL_CONFIG.navigation.showNavigationMenu && isVisible
                }
              >
                <StyledCollapseBtn
                  type="button"
                  onClick={() => setIsVisible(!isVisible)}
                  isVisible={isVisible}
                >
                  {isVisible && <Icons.Expand />}
                  {!isVisible && <Icons.Collapse />}
                </StyledCollapseBtn>
                <Main
                  navigation={FULL_CONFIG.navigation}
                  store={store}
                  basename={FULL_CONFIG.basename}
                  stylesConfig={stylesConfig}
                  annotationMessages={annotationsObjects}
                />
              </DashboardComponentWrapper>
            </Router>
          </RootComponentWrapper>
        )}
      </ContentWrapper>
    </div>
  );
};
