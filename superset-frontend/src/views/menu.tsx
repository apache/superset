// DODO was here

// Menu App. Used in views that do not already include the Menu component in the layout.
// eg, backend rendered views
import { Provider } from 'react-redux';
import ReactDOM from 'react-dom';
import { Route, BrowserRouter } from 'react-router-dom';
import { CacheProvider } from '@emotion/react';
import { QueryParamProvider } from 'use-query-params';
import createCache from '@emotion/cache';
import { ThemeProvider } from '@superset-ui/core';
import Menu from 'src/features/home/Menu';
import { theme } from 'src/preamble';
import getBootstrapData from 'src/utils/getBootstrapData';
import { setupStore } from './store';

// Disable connecting to redux debugger so that the React app injected
// Below the menu like SqlLab or Explore can connect its redux store to the debugger
const store = setupStore({ disableDebugger: true });
const bootstrapData = getBootstrapData();
const menu = { ...bootstrapData.common.menu_data };

const emotionCache = createCache({
  key: 'menu',
});

const app = (
  // @ts-ignore: emotion types defs are incompatible between core and cache
  <CacheProvider value={emotionCache}>
    <ThemeProvider theme={theme}>
      <Provider store={store}>
        <BrowserRouter>
          <QueryParamProvider
            ReactRouterRoute={Route}
            stringifyOptions={{ encode: false }}
          >
            <Menu
              data={menu}
              connectionError={false} // DODO added 47383817
              setConnectionError={() => {}} // DODO added 47383817
            />
          </QueryParamProvider>
        </BrowserRouter>
      </Provider>
    </ThemeProvider>
  </CacheProvider>
);

ReactDOM.render(app, document.getElementById('app-menu'));
