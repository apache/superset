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
import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import { t } from '@superset-ui/core';
import { Switchboard } from '@superset-ui/switchboard';
import { bootstrapData } from 'src/preamble';
import setupClient from 'src/setup/setupClient';
import { RootContextProviders } from 'src/views/RootContextProviders';
import { store } from 'src/views/store';
import ErrorBoundary from 'src/components/ErrorBoundary';
import Loading from 'src/components/Loading';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import ToastContainer from 'src/components/MessageToasts/ToastContainer';

const debugMode = process.env.WEBPACK_MODE === 'development';

function log(...info: unknown[]) {
  if (debugMode) {
    console.debug(`[superset]`, ...info);
  }
}

const LazyDashboardPage = lazy(
  () =>
    import(
      /* webpackChunkName: "DashboardPage" */ 'src/dashboard/containers/DashboardPage'
    ),
);

const EmbeddedApp = () => (
  <Router>
    <Route path="/dashboard/:idOrSlug/embedded">
      <Suspense fallback={<Loading />}>
        <RootContextProviders>
          <ErrorBoundary>
            <LazyDashboardPage />
          </ErrorBoundary>
          <ToastContainer position="top" />
        </RootContextProviders>
      </Suspense>
    </Route>
  </Router>
);

const appMountPoint = document.getElementById('app')!;

const MESSAGE_TYPE = '__embedded_comms__';

if (!window.parent) {
  appMountPoint.innerHTML =
    'This page is intended to be embedded in an iframe, but no window.parent was found.';
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

/**
 * Configures SupersetClient with the correct settings for the embedded dashboard page.
 */
function setupGuestClient(guestToken: string) {
  setupClient({
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

    const switchboard = new Switchboard({
      port,
      name: 'superset',
      debug: debugMode,
    });

    let started = false;

    switchboard.defineMethod('guestToken', ({ guestToken }) => {
      setupGuestClient(guestToken);
      if (!started) {
        ReactDOM.render(<EmbeddedApp />, appMountPoint);
        started = true;
      }
    });

    switchboard.defineMethod('getScrollSize', () => ({
      width: document.body.scrollWidth,
      height: document.body.scrollHeight,
    }));

    switchboard.start();
  }
});

log('embed page is ready to receive messages');
