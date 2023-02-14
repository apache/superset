import { MicrofrontendNavigation } from '../types/global';
import { validateConfig, serializeValue } from './utils';

const composeDashboardsList = (
  destination: {
    ENVIRONMENT: string;
    BUSINESS: string;
    ROLE: string;
    EXTRA: string;
    COMMON_DASHBOARDS: Record<string, any>;
    MAIN_MENU_HELPER: Record<string, any>;
    FINAL_CONFIGURATION: Record<string, any>;
  },
  // isSingleDashboard: boolean,
  withCommonDashboards: boolean,
  withMainMenuHelper: boolean,
) => {
  const {
    ENVIRONMENT,
    ROLE,
    EXTRA,
    BUSINESS,
    COMMON_DASHBOARDS,
    MAIN_MENU_HELPER,
    FINAL_CONFIGURATION,
  } = destination;

  let CONFIG = {};

  if (withMainMenuHelper) {
    CONFIG = {
      ...CONFIG,
      ...MAIN_MENU_HELPER,
    };
  }

  if (withCommonDashboards) {
    CONFIG = {
      ...CONFIG,
      ...COMMON_DASHBOARDS,
    };
  }

  if (ENVIRONMENT && ROLE && EXTRA && BUSINESS) {
    try {
      const foundConfig = FINAL_CONFIGURATION[ROLE][EXTRA];

      CONFIG = {
        ...CONFIG,
        ...foundConfig,
      };

      console.log('Composed navigation:', CONFIG);

      return CONFIG;
    } catch (err) {
      console.error('Cannot compose navigation error:', err);
      console.group('Parameters used:');
      console.log('FINAL_CONFIGURATION', FINAL_CONFIGURATION);
      console.log('ENVIRONMENT', ENVIRONMENT);
      console.log('BUSINESS', BUSINESS);
      console.log('ROLE', ROLE);
      console.log('EXTRA', EXTRA);
      console.groupEnd();
      return {};
    }
  } else {
    console.error('Some of the params were not found');
    console.log('ENVIRONMENT', ENVIRONMENT);
    console.log('ROLE', ROLE);
    console.log('EXTRA', EXTRA);
    console.log('BUSINESS', BUSINESS);
    return {};
  }
};

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
const IS_UNAVAILABLE =
  serializeValue(process.env.isUnavailable) === 'true';

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

const getNavigationConfig = (): {
  navigation: MicrofrontendNavigation;
} => {
  // Always a dynamic list of dashboards defined by env and destination
  const navigationRoutes = composeDashboardsList(
    PARSED_DESTINATION,
    // IS_SINGLE_DASHBOARD,
    IS_WITH_COMMON_DASHBOARDS,
    IS_WITH_MAIN_MENU_HELPER,
  );

  const fullNavigationConfig = {
    navigation: {
      showNavigationMenu: SHOW_NAVIGATION_MENU,
      main: 'Main',
      // base: '/', base route is defined on production by external params
      routes: Object.keys(navigationRoutes).map(
        keyName => navigationRoutes[keyName],
      ),
      routesObject: navigationRoutes,
    },
  };

  console.log('Full navigation config:', fullNavigationConfig);
  return fullNavigationConfig;
};

const getFullConfig = (
  env: 'development' | 'production' | 'none',
  config: {
    navigation: MicrofrontendNavigation;
  },
) => {
  console.group('Getting full config');
  console.log('env', env);
  console.log('Incomming', config);

  if (env === 'production') {
    const fullConfig = { ...config, frontendLogger: false };
    // @ts-ignore
    delete fullConfig.basename;
    console.log('Full config', fullConfig);
    return fullConfig;
  }

  if (env === 'development') {
    const fullConfig = {
      ...config,
      basename: '/',
      // used only with port 3000
      originUrl: 'https://superset.dodois.dev',
      frontendLogger: true,
    };
    console.log('Full config', fullConfig);
    return fullConfig;
  }

  // env === 'none'
  const fullConfig = {
    ...config,
    frontendLogger: true,

    // basename is defined using external params

    // basename: '/OfficeManager/Analytics',
    basename: '/',

    /* for production API use port 6479 */
    originUrl: 'https://analytics.dodois.io',

    /* for development API use port 3000 */
    // originUrl: 'https://superset.dodois.dev',
  };
  console.log('Full config', fullConfig);
  console.groupEnd();
  return fullConfig;
};

export { APP_VERSION, getFullConfig, getNavigationConfig };
