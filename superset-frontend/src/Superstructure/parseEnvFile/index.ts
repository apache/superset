import { MicrofrontendNavigation, RouteConfig } from '../types/global';
import { serializeValue } from './utils';

const APP_VERSION = serializeValue(process.env.APP_VERSION);
const ENVIRONMENT = serializeValue(process.env.env);
const TYPE = serializeValue(process.env.type);
const IS_UNAVAILABLE = serializeValue(process.env.isUnavailable) === 'true';

console.groupCollapsed('ENV file');
console.log('ENVIRONMENT', ENVIRONMENT);
console.log('TYPE', TYPE);
console.log('IS_UNAVAILABLE', IS_UNAVAILABLE);
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
    name: 'Main Page',
    nameRU: 'Главная',
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
    showNavigationMenu: true,
    routes: populateWithMainMenu(dynamicDashboardRoutes),
  },
});

export { APP_VERSION, getNavigationConfig };
