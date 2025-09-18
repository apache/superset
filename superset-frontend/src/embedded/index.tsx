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
import 'src/public-path';

import { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import {
  type SupersetThemeConfig,
  makeApi,
  t,
  logging,
} from '@superset-ui/core';
import Switchboard from '@superset-ui/switchboard';
import getBootstrapData, { applicationRoot } from 'src/utils/getBootstrapData';
import setupClient from 'src/setup/setupClient';
import setupPlugins from 'src/setup/setupPlugins';
import { useUiConfig } from 'src/components/UiConfigContext';
import { store, USER_LOADED } from 'src/views/store';
import { Loading } from '@superset-ui/core/components';
import { ErrorBoundary } from 'src/components';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import ToastContainer from 'src/components/MessageToasts/ToastContainer';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import {
  EmbeddedContextProviders,
  getThemeController,
} from './EmbeddedContextProviders';
import { embeddedApi } from './api';
import { getDataMaskChangeTrigger } from './utils';

setupPlugins();

const debugMode = process.env.WEBPACK_MODE === 'development';
const bootstrapData = getBootstrapData();

function log(...info: unknown[]) {
  if (debugMode) logging.debug(`[superset]`, ...info);
}

const LazyDashboardPage = lazy(
  () =>
    import(
      /* webpackChunkName: "DashboardPage" */ 'src/dashboard/containers/DashboardPage'
    ),
);

const EmbededLazyDashboardPage = () => {
  const uiConfig = useUiConfig();

  // Emit data mask changes to the parent window
  if (uiConfig?.emitDataMasks) {
    log('setting up Switchboard event emitter');

    let previousDataMask = store.getState().dataMask;

    store.subscribe(() => {
      const currentState = store.getState();
      const currentDataMask = currentState.dataMask;

      // Only emit if the dataMask has changed
      if (previousDataMask !== currentDataMask) {
        Switchboard.emit('observeDataMask', {
          ...currentDataMask,
          ...getDataMaskChangeTrigger(currentDataMask, previousDataMask),
        });
        previousDataMask = currentDataMask;
      }
    });
  }

  return <LazyDashboardPage idOrSlug={bootstrapData.embedded!.dashboard_id} />;
};

const EmbeddedRoute = () => (
  <EmbeddedContextProviders>
    <Suspense fallback={<Loading />}>
      <ErrorBoundary>
        <EmbededLazyDashboardPage />
      </ErrorBoundary>
      <ToastContainer position="top" />
    </Suspense>
  </EmbeddedContextProviders>
);

const EmbeddedApp = () => (
  <Router basename={applicationRoot()}>
    {/* todo (embedded) remove this line after uuids are deployed */}
    <Route path="/dashboard/:idOrSlug/embedded/" component={EmbeddedRoute} />
    <Route path="/embedded/:uuid/" component={EmbeddedRoute} />
  </Router>
);

const appMountPoint = document.getElementById('app')!;

const MESSAGE_TYPE = '__embedded_comms__';

function showFailureMessage(message: string) {
  appMountPoint.innerHTML = message;
}

if (!window.parent || window.parent === window) {
  showFailureMessage(
    t(
      'This page is intended to be embedded in an iframe, but it looks like that is not the case.',
    ),
  );
}

// if the page is embedded in an origin that hasn't
// been authorized by the curator, we forbid access entirely.
// todo: check the referrer on the route serving this page instead
// const ALLOW_ORIGINS = ['http://127.0.0.1:9001', 'http://localhost:9001'];
// const parentOrigin = new URL(document.referrer).origin;
// if (!ALLOW_ORIGINS.includes(parentOrigin)) {
//   throw new Error(
//     `[superset] iframe parent ${parentOrigin} is not in the list of allowed origins`,
//   );
// }

let displayedUnauthorizedToast = false;

/**
 * If there is a problem with the guest token, we will start getting
 * 401 errors from the api and SupersetClient will call this function.
 */
function guestUnauthorizedHandler() {
  if (displayedUnauthorizedToast) return; // no need to display this message every time we get another 401
  displayedUnauthorizedToast = true;
  // If a guest user were sent to a login screen on 401, they would have no valid login to use.
  // For embedded it makes more sense to just display a message
  // and let them continue accessing the page, to whatever extent they can.
  store.dispatch(
    addDangerToast(
      t(
        'This session has encountered an interruption, and some controls may not work as intended. If you are the developer of this app, please check that the guest token is being generated correctly.',
      ),
      {
        duration: -1, // stay open until manually closed
        noDuplicate: true,
      },
    ),
  );
}

function start() {
  const getMeWithRole = makeApi<void, { result: UserWithPermissionsAndRoles }>({
    method: 'GET',
    endpoint: '/api/v1/me/roles/',
  });
  return getMeWithRole().then(
    ({ result }) => {
      // fill in some missing bootstrap data
      // (because at pageload, we don't have any auth yet)
      // this allows the frontend's permissions checks to work.
      bootstrapData.user = result;
      store.dispatch({
        type: USER_LOADED,
        user: result,
      });
      ReactDOM.render(<EmbeddedApp />, appMountPoint);
    },
    err => {
      // something is most likely wrong with the guest token
      logging.error(err);
      showFailureMessage(
        t(
          'Something went wrong with embedded authentication. Check the dev console for details.',
        ),
      );
    },
  );
}

/**
 * Configures SupersetClient with the correct settings for the embedded dashboard page.
 */
function setupGuestClient(guestToken: string) {
  setupClient({
    appRoot: applicationRoot(),
    guestToken,
    guestTokenHeaderName: bootstrapData.config?.GUEST_TOKEN_HEADER_NAME,
    unauthorizedHandler: guestUnauthorizedHandler,
  });
}

function validateMessageEvent(event: MessageEvent) {
  // if (!ALLOW_ORIGINS.includes(event.origin)) {
  //   throw new Error('Message origin is not in the allowed list');
  // }

  if (typeof event.data !== 'object' || event.data.type !== MESSAGE_TYPE) {
    throw new Error(`Message type does not match type used for embedded comms`);
  }
}

window.addEventListener('message', function embeddedPageInitializer(event) {
  try {
    validateMessageEvent(event);
  } catch (err) {
    log('ignoring message unrelated to embedded comms', err, event);
    return;
  }

  const port = event.ports?.[0];
  if (event.data.handshake === 'port transfer' && port) {
    log('message port received', event);

    Switchboard.init({
      port,
      name: 'superset',
      debug: debugMode,
    });

    let started = false;

    Switchboard.defineMethod(
      'guestToken',
      ({ guestToken }: { guestToken: string }) => {
        setupGuestClient(guestToken);
        if (!started) {
          start();
          started = true;
        }
      },
    );

    Switchboard.defineMethod('getScrollSize', embeddedApi.getScrollSize);
    Switchboard.defineMethod(
      'getDashboardPermalink',
      embeddedApi.getDashboardPermalink,
    );
    Switchboard.defineMethod('getActiveTabs', embeddedApi.getActiveTabs);
    Switchboard.defineMethod('getDataMask', embeddedApi.getDataMask);
    Switchboard.defineMethod(
      'setThemeConfig',
      (payload: { themeConfig: SupersetThemeConfig }) => {
        const { themeConfig } = payload;
        log('Received setThemeConfig request:', themeConfig);

        try {
          const themeController = getThemeController();
          themeController.setThemeConfig(themeConfig);
          return { success: true, message: 'Theme applied' };
        } catch (error) {
          logging.error('Failed to apply theme config:', error);
          throw new Error(`Failed to apply theme config: ${error.message}`);
        }
      },
    );

    Switchboard.start();
  }
});

// Clean up theme controller on page unload
window.addEventListener('beforeunload', () => {
  try {
    const controller = getThemeController();
    if (controller) {
      log('Destroying theme controller');
      controller.destroy();
    }
  } catch (error) {
    logging.warn('Failed to destroy theme controller:', error);
  }
});

log('embed page is ready to receive messages');
