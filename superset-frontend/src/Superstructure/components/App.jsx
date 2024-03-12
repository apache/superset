import { hot } from 'react-hot-loader/root';
import React from 'react';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@superset-ui/core';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DynamicPluginProvider } from 'src/components/DynamicPlugins';
import setupApp from 'src/setup/setupApp';
import DashboardPage from 'src/Superstructure/components/DashboardPage';
import { theme } from '../../preamble';

setupApp();

const App = ({ store, dashboardIdOrSlug }) => (
  <Provider store={store}>
    <DndProvider backend={HTML5Backend}>
      <ThemeProvider theme={theme}>
        <DynamicPluginProvider>
          <DashboardPage store={store} idOrSlug={dashboardIdOrSlug} />
        </DynamicPluginProvider>
      </ThemeProvider>
    </DndProvider>
  </Provider>
);

export default hot(App);
