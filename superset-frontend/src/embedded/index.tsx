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
import { Switchboard } from '@superset-ui/switchboard';
import { bootstrapData } from 'src/preamble';
import setupClient from 'src/setup/setupClient';
import { RootContextProviders } from 'src/views/RootContextProviders';
import ErrorBoundary from 'src/components/ErrorBoundary';
import Loading from 'src/components/Loading';

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

function setupGuestClient(guestToken: string) {
  // need to reconfigure SupersetClient to use the guest token
  setupClient({
    guestToken,
    guestTokenHeaderName: bootstrapData.config?.GUEST_TOKEN_HEADER_NAME,
  });
}

function validateMessageEvent(event: MessageEvent) {
  if (
    event.data?.type === 'webpackClose' ||
    event.data?.source === '@devtools-page'
  ) {
    // sometimes devtools use the messaging api and we want to ignore those
    throw new Error("Sir, this is a Wendy's");
  }

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
    log('ignoring message', err, event);
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
