import { MicrofrontendNavigation, RouteConfig } from '../types/global';
import { validateConfig, serializeValue } from './utils';

const APP_VERSION = serializeValue(process.env.APP_VERSION);
const ENVIRONMENT = serializeValue(process.env.env);
const BUSINESS = serializeValue(process.env.business);
const ROLE = serializeValue(process.env.role);
const EXTRA = serializeValue(process.env.extra);
const IS_SINGLE_DASHBOARD =
  serializeValue(process.env.singleDashboard) === 'true';
const IS_WITH_COMMON_DASHBOARDS =
  serializeValue(process.env.withCommonDashboards) === 'true';
const IS_WITH_MAIN_MENU_HELPER =
  serializeValue(process.env.withMainMenuHelper) === 'true';
const IS_UNAVAILABLE = serializeValue(process.env.isUnavailable) === 'true';

console.groupCollapsed('ENV file');
console.log('ENVIRONMENT', ENVIRONMENT);
console.log('BUSINESS', BUSINESS);
console.log('ROLE', ROLE);
console.log('EXTRA', EXTRA);
console.log('IS_SINGLE_DASHBOARD', IS_SINGLE_DASHBOARD);
console.log('IS_WITH_COMMON_DASHBOARDS', IS_WITH_COMMON_DASHBOARDS);
console.log('IS_WITH_MAIN_MENU_HELPER', IS_WITH_MAIN_MENU_HELPER);
console.log('IS_UNAVAILABLE', IS_UNAVAILABLE);

// TODO: not working logic
// const WITH_MAIN_MENU_HELPER = false;

const PARSED_DESTINATION = validateConfig(ENVIRONMENT, BUSINESS, ROLE, EXTRA);
const SHOW_NAVIGATION_MENU = IS_WITH_MAIN_MENU_HELPER;

console.log('Parsed destination', PARSED_DESTINATION);
console.groupEnd();

/**
 *
 * @param dynamicDashboardRoutes RouteConfig[] | null
 * @returns RouteConfig[]
 */
const populateWithMainMenu = (
  dynamicDashboardRoutes: RouteConfig[] | null,
): RouteConfig[] => {
  const mainRoute = {
    idOrSlug: null,
    name: 'Главная',
    location: '/',
    hidden: false,
    isMainRoute: true,
  };
  const returningArray = [mainRoute] as RouteConfig[];

  if (dynamicDashboardRoutes && dynamicDashboardRoutes.length) {
    for (let i = 0; i < dynamicDashboardRoutes.length; i += 1) {
      returningArray.push(dynamicDashboardRoutes[i]);
    }
  }

  return returningArray;
};

/**
 *
 * @param dynamicDashboardRoutes RouteConfig[]
 * @returns { navigation: MicrofrontendNavigation }
 */
const getNavigationConfig = (
  dynamicDashboardRoutes: RouteConfig[],
): {
  navigation: MicrofrontendNavigation;
} => ({
  navigation: {
    showNavigationMenu: SHOW_NAVIGATION_MENU,
    routes: populateWithMainMenu(dynamicDashboardRoutes),
  },
});

/**
 *
 * @param env 'development' | 'production' | 'none'
 * @returns { basename: string; originUrl: string; frontendLogger: boolean }
 */
const getCoreConfig = (
  env: 'development' | 'production' | 'none',
): { basename: string; originUrl: string; frontendLogger: boolean } => {
  if (env === 'production') {
    return { basename: '', frontendLogger: false, originUrl: '' };
  }

  // works only with port 3000
  if (env === 'development') {
    return {
      basename: '/',
      originUrl: 'https://superset.dodois.dev',
      frontendLogger: true,
    };
  }

  // env === 'none'
  return {
    frontendLogger: true,

    // basename is defined using external params

    // basename: '/OfficeManager/Analytics',
    basename: '/',

    /* for production API use port 6479 */
    originUrl: 'https://analytics.dodois.io',

    /* for development API use port 3000 */
    // originUrl: 'https://superset.dodois.dev',
  };
};

export { APP_VERSION, getCoreConfig, getNavigationConfig };
