/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { Suspense, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Redirect,
  useLocation,
} from 'react-router-dom';
import { bindActionCreators } from 'redux';
import { css, useTheme } from '@apache-superset/core/theme';
import { Flex, Layout, Loading } from '@superset-ui/core/components';
import { setupAGGridModules } from '@superset-ui/core/components/ThemedAgGridReact';
import { ErrorBoundary } from 'src/components';
import Menu from 'src/features/home/Menu';
import getBootstrapData, { applicationRoot } from 'src/utils/getBootstrapData';
import ToastContainer from 'src/components/MessageToasts/ToastContainer';
import setupApp from 'src/setup/setupApp';
import setupPlugins from 'src/setup/setupPlugins';
import { routes, isFrontendRoute } from 'src/views/routes';
import { Logger, LOG_ACTIONS_SPA_NAVIGATION } from 'src/logger/LogUtils';
import setupCodeOverrides from 'src/setup/setupCodeOverrides';
import { logEvent } from 'src/logger/actions';
import { store } from 'src/views/store';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import { isUser } from 'src/types/bootstrapTypes';
import ExtensionsStartup from 'src/extensions/ExtensionsStartup';
import { Splitter } from 'src/components/Splitter';
import { ChatFloatingHost, ChatPanelHost, useChat } from 'src/core/chat';
import useStoredSidebarWidth from 'src/components/ResizableSidebar/useStoredSidebarWidth';
import { RootContextProviders } from './RootContextProviders';
import { ScrollToTop } from './ScrollToTop';

setupApp();
setupPlugins();
setupCodeOverrides();
setupAGGridModules();

const bootstrapData = getBootstrapData();

// WCAG 3.1.2: Set the HTML lang attribute based on the current locale
// so screen readers announce the correct language for the page content.
// Normalize to BCP-47 format by replacing underscores with hyphens
// so region subtags like "pt_BR" become valid "pt-BR" rather than being dropped.
const locale =
  bootstrapData.common?.locale || window.navigator.language || 'en';
document.documentElement.lang = String(locale).replace(/_/g, '-');

let lastLocationPathname: string;

const boundActions = bindActionCreators({ logEvent }, store.dispatch);

const LocationPathnameLogger = () => {
  const location = useLocation();
  useEffect(() => {
    // This will log client side route changes for single page app user navigation
    boundActions.logEvent(LOG_ACTIONS_SPA_NAVIGATION, {
      path: location.pathname,
    });
    // reset performance logger timer start point to avoid soft navigation
    // cause dashboard perf measurement problem
    if (lastLocationPathname && lastLocationPathname !== location.pathname) {
      Logger.markTimeOrigin();
    }
    lastLocationPathname = location.pathname;
  }, [location.pathname]);
  return <></>;
};

const CHAT_PANEL_DEFAULT_WIDTH = 400;
const CHAT_PANEL_MIN_WIDTH = 280;

const RouteSwitch = () => {
  const theme = useTheme();
  return (
    <Switch>
      {routes.map(({ path, Component, props = {}, Fallback = Loading }) => (
        <Route path={path} key={path}>
          <Suspense fallback={<Fallback />}>
            <ErrorBoundary
              css={css`
                margin: ${theme.sizeUnit * 4}px;
              `}
            >
              <Component user={bootstrapData.user} {...props} />
            </ErrorBoundary>
          </Suspense>
        </Route>
      ))}
      <Redirect from="/" to="/welcome/" exact />
    </Switch>
  );
};

const layoutCss = css`
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

const contentCss = css`
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  position: relative;
`;

// Chat panel mode locks the shell (content scrolls inside its panel); every
// other state page-scrolls so the navbar hides on scroll.
const lockedShellCss = css`
  height: 100vh;
  overflow: hidden;
`;

const pageScrollShellCss = css`
  min-height: 100vh;
`;

const pageScrollContentCss = css`
  display: flex;
  flex-direction: column;
`;

// Renders the app shell and picks the scroll model: in chat panel mode <Layout>
// sits in a Splitter beside the chat panel; otherwise the page scrolls normally.
const AppContent = () => {
  const isAuthenticated =
    isUser(bootstrapData.user) && !bootstrapData.user.isAnonymous;
  const chatExtensionsEnabled =
    isFeatureEnabled(FeatureFlag.EnableExtensions) && isAuthenticated;
  const { open: panelOpen, mode, chat } = useChat();
  const hasChatExtension = chatExtensionsEnabled && !!chat;
  const isPanelOpen = hasChatExtension && mode === 'panel' && panelOpen;

  const [storedWidth, setStoredWidth] = useStoredSidebarWidth(
    'chat:panel',
    CHAT_PANEL_DEFAULT_WIDTH,
  );

  const layoutContent = (
    <Layout css={isPanelOpen ? layoutCss : undefined}>
      <Layout.Content css={isPanelOpen ? contentCss : pageScrollContentCss}>
        <RouteSwitch />
      </Layout.Content>
    </Layout>
  );

  const content = isPanelOpen ? (
    <Splitter
      lazy
      onResizeEnd={sizes => {
        const chatWidth = sizes[sizes.length - 1];
        if (
          typeof chatWidth === 'number' &&
          chatWidth >= CHAT_PANEL_MIN_WIDTH
        ) {
          setStoredWidth(chatWidth);
        }
      }}
      css={css`
        flex: 1;
        min-height: 0;
        overflow: hidden;

        /*
         * Splitter.Panel is not a flex container by default, so flex:1 on
         * children (Layout, ChatPanelHost) has no height effect and
         * panels collapse. Making them flex columns lets children fill them.
         */
        & > .ant-splitter-panel {
          display: flex !important;
          flex-direction: column;
        }
      `}
    >
      <Splitter.Panel>{layoutContent}</Splitter.Panel>
      <Splitter.Panel size={storedWidth} min={CHAT_PANEL_MIN_WIDTH}>
        <ChatPanelHost />
      </Splitter.Panel>
    </Splitter>
  ) : (
    <>
      {layoutContent}
      {hasChatExtension && <ChatFloatingHost />}
    </>
  );

  return (
    <Flex vertical css={isPanelOpen ? lockedShellCss : pageScrollShellCss}>
      <Menu
        data={bootstrapData.common.menu_data}
        isFrontendRoute={isFrontendRoute}
      />
      <ExtensionsStartup>{content}</ExtensionsStartup>
    </Flex>
  );
};

const App = () => (
  <Router basename={applicationRoot()}>
    <ScrollToTop />
    <LocationPathnameLogger />
    <RootContextProviders>
      <AppContent />
      <ToastContainer />
    </RootContextProviders>
  </Router>
);

export default App;
