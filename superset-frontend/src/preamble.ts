// DODO was here
import { setConfig as setHotLoaderConfig } from 'react-hot-loader';
import 'abortcontroller-polyfill/dist/abortcontroller-polyfill-only';
import moment from 'moment';
// eslint-disable-next-line no-restricted-imports
import {
  configure,
  makeApi,
  supersetTheme,
  initFeatureFlags,
} from '@superset-ui/core';
import { merge } from 'lodash';
import setupClient from './setup/setupClient';
import setupColors from './setup/setupColors';
import setupFormatters from './setup/setupFormatters';
import setupDashboardComponents from './setup/setupDashboardComponents';
import { BootstrapUser, User } from './types/bootstrapTypes';
import getBootstrapData from './utils/getBootstrapData';
import { DODOPIZZA_THEME_OVERRIDES } from './Superstructure/constants'; // DODO added 44611022

const isStandalone = process.env.type === undefined; // DODO added 44611022

if (process.env.WEBPACK_MODE === 'development') {
  setHotLoaderConfig({ logLevel: 'debug', trackTailUpdates: false });
}

// const bootstrapData = getBootstrapData(); // DODO commented out 44611022

// DODO added start 44611022
// eslint-disable-next-line import/no-mutable-exports
export let bootstrapData: {
  user?: BootstrapUser;
  common?: any;
  config?: any;
  embedded?: {
    dashboard_id: string;
  };
} = {};

bootstrapData = {
  ...getBootstrapData(),
};
// DODO added stop 44611022
// Configure translation
if (typeof window !== 'undefined') {
  // DODO added start 44611022
  const root = document.getElementById('app');
  const dataBootstrap = root
    ? JSON.parse(root.getAttribute('data-bootstrap') || '{}')
    : {};

  bootstrapData = {
    ...dataBootstrap,
    common: {
      ...dataBootstrap?.common,
      locale: dataBootstrap?.common?.locale || 'ru',
    },
  };
  // DODO added stop 44611022

  configure({ languagePack: bootstrapData.common.language_pack });
  moment.locale(bootstrapData.common.locale);
} else {
  configure();
}

// Configure feature flags
initFeatureFlags(bootstrapData.common.feature_flags);

// Setup SupersetClient
setupClient();

setupColors(
  bootstrapData.common.extra_categorical_color_schemes,
  bootstrapData.common.extra_sequential_color_schemes,
);

// Setup number formatters
setupFormatters(
  bootstrapData.common.d3_format,
  bootstrapData.common.d3_time_format,
);

setupDashboardComponents();

export const theme = merge(
  supersetTheme,
  // DODO changed 44611022
  isStandalone
    ? bootstrapData.common.theme_overrides ?? {}
    : DODOPIZZA_THEME_OVERRIDES,
);

const getMe = makeApi<void, User>({
  method: 'GET',
  endpoint: '/api/v1/me/',
});

/**
 * When you re-open the window, we check if you are still logged in.
 * If your session expired or you signed out, we'll redirect to login.
 * If you aren't logged in in the first place (!isActive), then we shouldn't do this.
 */
if (bootstrapData.user?.isActive) {
  document.addEventListener('visibilitychange', () => {
    // we only care about the tab becoming visible, not vice versa
    if (document.visibilityState !== 'visible') return;

    getMe().catch(() => {
      // ignore error, SupersetClient will redirect to login on a 401
    });
  });
}
