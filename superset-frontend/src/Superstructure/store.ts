import thunk from 'redux-thunk';
import { createStore, applyMiddleware, compose } from 'redux';
import { initFeatureFlags } from 'src/Superstructure/utils/featureFlags';
import {
  USER_ROLES,
  SUPERSET_WEBSERVER_TIMEOUT,
} from 'src/Superstructure/constants';
import { initEnhancer } from 'src/reduxUtils';
import rootReducer from 'src/Superstructure/reducers/index';

// TODO: get data bootstrap from superset API
// Because the roles are empty -> export in CSV is not shown
const bootstrap = {
  user: { roles: USER_ROLES },
  common: {
    conf: { SUPERSET_WEBSERVER_TIMEOUT },
    feature_flags: {
      DASHBOARD_NATIVE_FILTERS: true,
      DASHBOARD_NATIVE_FILTERS_SET: false,
      GLOBAL_ASYNC_QUERIES: true,
      // TODO: breaks logic
      DYNAMIC_PLUGINS: true,
    },
  },
};

initFeatureFlags(bootstrap.common.feature_flags);

export const store = createStore(
  rootReducer,
  bootstrap,
  compose(applyMiddleware(thunk), initEnhancer(false)),
);
