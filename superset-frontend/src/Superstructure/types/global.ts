export interface RouteConfig {
  idOrSlug: null | string | number;
  location: string;
  name: string;
  nameRU: string;
  hidden: boolean;
}

export interface MicrofrontendNavigation {
  showNavigationMenu: boolean;
  routes: RouteConfig[];
}

export interface FullConfiguration {
  navigation: MicrofrontendNavigation;
  originUrl: string;
  frontendLogger: boolean;
  basename: string;
}

export interface MicrofrontendParams {
  originUrl?: string;
  frontendLogger?: boolean;
  token?: string;
  basename?: string;
  businessId?: 'dodopizza' | 'drinkit' | 'doner42';
}

export type RoutesConfig = MicrofrontendNavigation['routes'];

export interface StylesConfig {
  businessId: string;
  colors: {
    primary: string;
    secondary: string;
    light: string;
    dark: string;
  };
}

export type AnnotationMessages = InitializedResponse<{
  result: SingleAnnotation;
}>[];

export type BusinessId = 'dodopizza' | 'drinkit' | 'doner42';

export interface MainComponentProps {
  navigation: MicrofrontendNavigation;
  store: any;
  theme?: any;
  basename: string;
  stylesConfig: StylesConfig;
  annotationMessages: AnnotationMessages;
  startDashboardId?: string | number;
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
  subTitle?: string;
  body?: string;
  extra?: string;
  children?: React.ReactNode;
  stylesConfig: StylesConfig;
}

export interface ErrorParams {
  stackTrace?: string;
  title?: string;
  subTitle?: string;
  body?: string;
  extra?: string;
  children?: React.ReactNode;
}

export interface IPanelMsgObj {
  title: string;
  date?: string;
  subTitle: string;
  extra?: string;
  listTitle?: string;
  listTitleExtra?: string;
  messages?: string[];
  releases?: {
    date: string;
    status: string;
    messages: string[];
  }[];
  messagesExtra?: string[];
  buttons?: { txt: string; link: string }[];
}

export interface Dashboard {
  certification_details: null | string;
  certified_by: null | string;
  dashboard_title: string;
  dashboard_title_RU?: string;
  id: number;
}

export interface DashboardFiltered {
  created_on_delta_humanized: string;
  changed_on_delta_humanized: string;
  dashboard_title: string;
  dashboard_title_RU?: string;
  id: number;
  certification_details: string;
  certified_by: string;
  status: string;
  url: string;
}

export interface AnnotationLayersFiltered {
  changed_on: string;
  changed_on_delta_humanized: string;
  created_on: string;
  descr: string;
  id: number;
  name: string;
}

export interface AnnotationLayer {
  changed_on: string;
  changed_on_delta_humanized: string;
  created_on: string;
  descr: string;
  id: number;
  name: string;
}

export interface SingleAnnotation {
  end_dttm: string;
  start_dttm: string;
  id: number;
  json_metadata: string;
  long_descr: string;
  short_descr: string;
}

export interface RouteFromDashboard {
  hidden: boolean;
  idOrSlug: number;
  name: string;
  nameRU: string;
  location: string;
}

export type ComposedMessage = {
  loaded: boolean;
  name: string;
  errorParams?: string;
};

export type CustomErrorObject<T> = {
  loaded: boolean;
  data: T;
  title: string;
  stackTrace: string;
  errorMsg?: string;
  isCustomError?: boolean;
};

export interface InitializedResponse<T> {
  loaded: boolean;
  error?: string;
  data: T;
  title: string;
  stackTrace: string;
}
