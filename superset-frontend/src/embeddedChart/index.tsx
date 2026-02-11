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

import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { makeApi, QueryFormData, StatefulChart } from '@superset-ui/core';
import { logging } from '@apache-superset/core';
import { t } from '@apache-superset/core/ui';
import Switchboard from '@superset-ui/switchboard';
import getBootstrapData, { applicationRoot } from 'src/utils/getBootstrapData';
import setupClient from 'src/setup/setupClient';
import setupPlugins from 'src/setup/setupPlugins';
import { store, USER_LOADED } from 'src/views/store';
import { Loading } from '@superset-ui/core/components';
import { ErrorBoundary, DynamicPluginProvider } from 'src/components';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import ToastContainer from 'src/components/MessageToasts/ToastContainer';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import { SupersetThemeProvider } from 'src/theme/ThemeProvider';
import { ThemeController } from 'src/theme/ThemeController';
import type { ThemeStorage } from '@apache-superset/core/ui';
import { Provider as ReduxProvider } from 'react-redux';

setupPlugins();

const debugMode = process.env.WEBPACK_MODE === 'development';
const bootstrapData = getBootstrapData();

function log(...info: unknown[]) {
  if (debugMode) logging.debug(`[superset-embedded-chart]`, ...info);
}

/**
 * In-memory implementation of ThemeStorage interface for embedded contexts.
 */
class ThemeMemoryStorageAdapter implements ThemeStorage {
  private storage = new Map<string, string>();

  getItem(key: string): string | null {
    return this.storage.get(key) || null;
  }

  setItem(key: string, value: string): void {
    this.storage.set(key, value);
  }

  removeItem(key: string): void {
    this.storage.delete(key);
  }
}

const themeController = new ThemeController({
  storage: new ThemeMemoryStorageAdapter(),
});

interface PermalinkState {
  formData: QueryFormData;
}

const appMountPoint = document.getElementById('app')!;
const MESSAGE_TYPE = '__embedded_comms__';

function showFailureMessage(message: string) {
  appMountPoint.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">${message}</div>`;
}

if (!window.parent || window.parent === window) {
  showFailureMessage(
    t(
      'This page is intended to be embedded in an iframe, but it looks like that is not the case.',
    ),
  );
}

let displayedUnauthorizedToast = false;

/**
 * Handle unauthorized errors from the API.
 */
function guestUnauthorizedHandler() {
  if (displayedUnauthorizedToast) return;
  displayedUnauthorizedToast = true;
  store.dispatch(
    addDangerToast(
      t(
        'This session has encountered an interruption. The embedded chart may not load correctly.',
      ),
      {
        duration: -1,
        noDuplicate: true,
      },
    ),
  );
}

/**
 * Configures SupersetClient with the correct settings for the embedded chart page.
 */
function setupGuestClient(guestToken: string) {
  // Strip any whitespace/newlines that could make the token an invalid HTTP header value
  const cleanToken = guestToken.replace(/\s/g, '');
  setupClient({
    appRoot: applicationRoot(),
    guestToken: cleanToken,
    guestTokenHeaderName: bootstrapData.config?.GUEST_TOKEN_HEADER_NAME,
    unauthorizedHandler: guestUnauthorizedHandler,
  });
}

function validateMessageEvent(event: MessageEvent) {
  const { data } = event;
  if (data == null || typeof data !== 'object' || data.type !== MESSAGE_TYPE) {
    throw new Error(`Message type does not match type used for embedded comms`);
  }
}

/**
 * Embedded Chart component that fetches formData from permalink and renders StatefulChart.
 */
function EmbeddedChartApp() {
  const [formData, setFormData] = useState<QueryFormData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchPermalinkData() {
      const urlParams = new URLSearchParams(window.location.search);
      const permalinkKey = urlParams.get('permalink_key');

      if (!permalinkKey) {
        if (isMounted) {
          setError(t('Missing permalink_key parameter'));
          setLoading(false);
        }
        return;
      }

      try {
        const getPermalinkData = makeApi<void, { state: PermalinkState }>({
          method: 'GET',
          endpoint: `/api/v1/embedded_chart/${permalinkKey}`,
        });

        const response = await getPermalinkData();
        const { state } = response;

        if (!state?.formData) {
          if (isMounted) {
            setError(t('Invalid permalink data: missing formData'));
            setLoading(false);
          }
          return;
        }

        log('Loaded formData from permalink:', state.formData);
        if (isMounted) {
          setFormData(state.formData);
          setLoading(false);
        }
      } catch (err) {
        logging.error('Failed to load permalink data:', err);
        if (isMounted) {
          setError(
            t('Failed to load chart data. The permalink may have expired.'),
          );
          setLoading(false);
        }
      }
    }

    fetchPermalinkData();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
        <Loading position="floating" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: 'sans-serif',
          padding: '20px',
          textAlign: 'center',
        }}
      >
        {error}
      </div>
    );
  }

  if (!formData) {
    return null;
  }

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <StatefulChart
        formData={formData}
        width="100%"
        height="100%"
        showLoading
        enableNoResults
      />
    </div>
  );
}

/**
 * Context providers wrapper for the embedded chart.
 */
function EmbeddedChartWithProviders() {
  return (
    <SupersetThemeProvider themeController={themeController}>
      <ReduxProvider store={store}>
        <DynamicPluginProvider>
          <ErrorBoundary>
            <EmbeddedChartApp />
          </ErrorBoundary>
          <ToastContainer position="top" />
        </DynamicPluginProvider>
      </ReduxProvider>
    </SupersetThemeProvider>
  );
}

function getGuestUserFallback(): UserWithPermissionsAndRoles {
  return {
    username: 'guest',
    firstName: 'Guest',
    lastName: 'User',
    isActive: true,
    isAnonymous: false,
    roles: {},
    permissions: {},
  };
}

function start() {
  const getMeWithRole = makeApi<void, { result: UserWithPermissionsAndRoles }>({
    method: 'GET',
    endpoint: '/api/v1/me/roles/',
  });
  return getMeWithRole()
    .then(
      ({ result }) => result,
      err => {
        // Guest role may lack can_read on Me — fall back to minimal user
        log('Could not fetch /api/v1/me/roles/, using guest defaults:', err);
        return getGuestUserFallback();
      },
    )
    .then(user => {
      bootstrapData.user = user;
      store.dispatch({
        type: USER_LOADED,
        user,
      });
      ReactDOM.render(<EmbeddedChartWithProviders />, appMountPoint);
    });
}

let started = false;

window.addEventListener('message', function embeddedChartInitializer(event) {
  try {
    validateMessageEvent(event);
  } catch (err) {
    log('ignoring message unrelated to embedded comms', err, event);
    return;
  }

  // Simple direct guestToken message (no Switchboard required)
  if (event.data.guestToken && !event.data.handshake) {
    log('received direct guestToken message');
    setupGuestClient(event.data.guestToken);
    if (!started) {
      started = true;
      start().catch(err => {
        logging.error('Failed to start after receiving guestToken', err);
        started = false;
      });
    }
    return;
  }

  // Switchboard-based communication (with MessagePort)
  const port = event.ports?.[0];
  if (event.data.handshake === 'port transfer' && port) {
    log('message port received', event);

    Switchboard.init({
      port,
      name: 'superset-embedded-chart',
      debug: debugMode,
    });

    Switchboard.defineMethod(
      'guestToken',
      ({ guestToken }: { guestToken: string }) => {
        setupGuestClient(guestToken);
        if (!started) {
          started = true;
          start().catch(err => {
            logging.error('Failed to start after receiving guestToken', err);
            started = false;
          });
        }
      },
    );

    Switchboard.start();
  }
});

log('embedded chart page is ready to receive messages');
