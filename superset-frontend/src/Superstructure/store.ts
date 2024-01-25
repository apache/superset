import thunk from 'redux-thunk';
import { createStore, applyMiddleware, compose } from 'redux';
import moment from 'moment';
import { configure } from '@superset-ui/core';
import { initFeatureFlags } from './utils/featureFlags';
import { USER_ROLES, SUPERSET_WEBSERVER_TIMEOUT } from './constants';
import { initEnhancer } from '../reduxUtils';
import rootReducer from './reducers/index';
import { SupersetPluginTranslations } from './translations';

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
  return 'en';
};

// TODO: get data bootstrap from superset API
// Because the roles are empty -> export in CSV is not shown
const locale = getLocaleForSuperset();

console.log('User Language: IN STORE', locale);

const bootstrap = {
  user: { roles: USER_ROLES },
  common: {
    conf: { SUPERSET_WEBSERVER_TIMEOUT },
    feature_flags: {
      GLOBAL_ASYNC_QUERIES: true,
      DYNAMIC_PLUGINS: true,
      DASHBOARD_NATIVE_FILTERS: true,
      DASHBOARD_CROSS_FILTERS: true,
      DASHBOARD_NATIVE_FILTERS_SET: false,
    },
    locale,
    language_pack: {
      ...SupersetPluginTranslations[locale],
    },
  },
};

initFeatureFlags(bootstrap.common.feature_flags);

// Configure translation
if (typeof window !== 'undefined') {
  if (bootstrap.common && bootstrap.common.language_pack) {
    const languagePack = bootstrap.common.language_pack;
    console.log('languagePack', languagePack);
    // @ts-ignore
    configure({ languagePack });
    moment.locale(bootstrap.common.locale);
  } else {
    configure();
  }
} else {
  configure();
}

export const store = createStore(
  rootReducer,
  bootstrap,
  compose(applyMiddleware(thunk), initEnhancer(false)),
);
