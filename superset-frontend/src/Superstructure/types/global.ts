export interface RouteConfig {
  idOrSlug: null | string | number;
  route: string;
  name: string;
  hidden: boolean;
}

export interface MicrofrontendNavigation {
  main: string;
  showNavigationMenu: boolean;
  routes: RouteConfig[];
  routesObject: Record<string, RouteConfig>;
}

export interface MicrofrontendParams {
  originUrl?: string;
  frontendLogger?: boolean;
  nativeFilters?: string;
  token?: string;
  basename?: string;
  navigation: MicrofrontendNavigation;
}

export type RoutesConfig = MicrofrontendNavigation['routes'];
export type MainRoute = MicrofrontendNavigation['main'];

export interface MainComponentProps {
  navigation: MicrofrontendNavigation;
  store: any;
  theme: any;
  basename: string;
}

export interface InitConfig {
  originUrl?: string;
  ENV?: string;
  CREDS?: { username: string; password: string; provider: string };
  FRONTEND_LOGGER?: boolean;
  token?: string;
}

export interface PanelMsgParams {
  title?: string;
  body?: string;
  children?: React.ReactNode;
}

export interface ErrorParams extends PanelMsgParams {
  stackTrace?: string;
}
