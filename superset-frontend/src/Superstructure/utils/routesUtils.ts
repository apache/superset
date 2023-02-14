import { MicrofrontendNavigation } from 'src/Superstructure/types/global';

export const getDashboardIdOrSlug = ({
  navigation,
  route,
}: {
  navigation: MicrofrontendNavigation;
  route: string;
}): null | string | number => {
  if (route) {
    const foundRoute = navigation.routes.filter(
      mappedRoute =>
        mappedRoute.idOrSlug === navigation.routesObject[route].idOrSlug,
    );
    if (foundRoute && foundRoute.length) return foundRoute[0].idOrSlug;
  }
  return null;
};
