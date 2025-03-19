/*
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

import {
  DASHBOARD_UI_FILTER_CONFIG_URL_PARAM_KEY,
  IFRAME_COMMS_MESSAGE_TYPE
} from './const';

// We can swap this out for the actual switchboard package once it gets published
import { Switchboard } from '@superset-ui/switchboard';
import { getGuestTokenRefreshTiming } from './guestTokenRefresh';

/**
 * The function to fetch a guest token from your Host App's backend server.
 * The Host App backend must supply an API endpoint
 * which returns a guest token with appropriate resource access.
 */
export type GuestTokenFetchFn = () => Promise<string>;

export type UiConfigType = {
  hideTitle?: boolean
  hideTab?: boolean
  hideChartControls?: boolean
  filters?: {
    [key: string]: boolean | undefined
    visible?: boolean
    expanded?: boolean
  }
  urlParams?: {
    [key: string]: any
  }
}

export type EmbedDashboardParams = {
  /** The id provided by the embed configuration UI in Superset */
  id: string
  /** The domain where Superset can be located, with protocol, such as: https://superset.example.com */
  supersetDomain: string
  /** The html element within which to mount the iframe */
  mountPoint: HTMLElement
  /** A function to fetch a guest token from the Host App's backend server */
  fetchGuestToken: GuestTokenFetchFn
  /** The dashboard UI config: hideTitle, hideTab, hideChartControls, filters.visible, filters.expanded **/
  dashboardUiConfig?: UiConfigType
  /** Are we in debug mode? */
  debug?: boolean
  /** The iframe title attribute */
  iframeTitle?: string
  /** additional iframe sandbox attributes ex (allow-top-navigation, allow-popups-to-escape-sandbox) **/
  iframeSandboxExtras?: string[]
}

export type Size = {
  width: number, height: number
}

export type EmbeddedDashboard = {
  getScrollSize: () => Promise<Size>
  unmount: () => void
  getDashboardPermalink: (anchor: string) => Promise<string>
  getActiveTabs: () => Promise<string[]>
}

/**
 * Embeds a Superset dashboard into the page using an iframe.
 */
export async function embedDashboard({
  id,
  supersetDomain,
  mountPoint,
  fetchGuestToken,
  dashboardUiConfig,
  debug = false,
  iframeTitle = "Embedded Dashboard",
  iframeSandboxExtras = []
}: EmbedDashboardParams): Promise<EmbeddedDashboard> {
  function log(...info: unknown[]) {
    if (debug) {
      console.debug(`[superset-embedded-sdk][dashboard ${id}]`, ...info);
    }
  }

  log('embedding');

  if (supersetDomain.endsWith("/")) {
    supersetDomain = supersetDomain.slice(0, -1);
  }

  function calculateConfig() {
    let configNumber = 0
    if(dashboardUiConfig) {
      if(dashboardUiConfig.hideTitle) {
        configNumber += 1
      }
      if(dashboardUiConfig.hideTab) {
        configNumber += 2
      }
      if(dashboardUiConfig.hideChartControls) {
        configNumber += 8
      }
    }
    return configNumber
  }

  async function mountIframe(): Promise<Switchboard> {
    return new Promise(resolve => {
      const iframe = document.createElement('iframe');
      const dashboardConfigUrlParams = dashboardUiConfig ? {uiConfig: `${calculateConfig()}`} : undefined;
      const filterConfig = dashboardUiConfig?.filters || {}
      const filterConfigKeys = Object.keys(filterConfig)
      const filterConfigUrlParams = Object.fromEntries(filterConfigKeys.map(
        key => [DASHBOARD_UI_FILTER_CONFIG_URL_PARAM_KEY[key], filterConfig[key]]))

      // Allow url query parameters from dashboardUiConfig.urlParams to override the ones from filterConfig
      const urlParams = {...dashboardConfigUrlParams, ...filterConfigUrlParams, ...dashboardUiConfig?.urlParams}
      const urlParamsString = Object.keys(urlParams).length ? '?' + new URLSearchParams(urlParams).toString() : ''

      // set up the iframe's sandbox configuration
      iframe.sandbox.add("allow-same-origin"); // needed for postMessage to work
      iframe.sandbox.add("allow-scripts"); // obviously the iframe needs scripts
      iframe.sandbox.add("allow-presentation"); // for fullscreen charts
      iframe.sandbox.add("allow-downloads"); // for downloading charts as image
      iframe.sandbox.add("allow-forms"); // for forms to submit
      iframe.sandbox.add("allow-popups"); // for exporting charts as csv
      // additional sandbox props
      iframeSandboxExtras.forEach((key: string) => {
        iframe.sandbox.add(key);
      });

      // add the event listener before setting src, to be 100% sure that we capture the load event
      iframe.addEventListener('load', () => {
        // MessageChannel allows us to send and receive messages smoothly between our window and the iframe
        // See https://developer.mozilla.org/en-US/docs/Web/API/Channel_Messaging_API
        const commsChannel = new MessageChannel();
        const ourPort = commsChannel.port1;
        const theirPort = commsChannel.port2;

        // Send one of the message channel ports to the iframe to initialize embedded comms
        // See https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
        // we know the content window isn't null because we are in the load event handler.
        iframe.contentWindow!.postMessage(
          { type: IFRAME_COMMS_MESSAGE_TYPE, handshake: "port transfer" },
          supersetDomain,
          [theirPort],
        )
        log('sent message channel to the iframe');

        // return our port from the promise
        resolve(new Switchboard({ port: ourPort, name: 'superset-embedded-sdk', debug }));
      });
      iframe.src = `${supersetDomain}/embedded/${id}${urlParamsString}`;
      iframe.title = iframeTitle;
      //@ts-ignore
      mountPoint.replaceChildren(iframe);
      log('placed the iframe')
    });
  }

  const [guestToken, ourPort]: [string, Switchboard] = await Promise.all([
    fetchGuestToken(),
    mountIframe(),
  ]);

  ourPort.emit('guestToken', { guestToken });
  log('sent guest token');

  async function refreshGuestToken() {
    const newGuestToken = await fetchGuestToken();
    ourPort.emit('guestToken', { guestToken: newGuestToken });
    setTimeout(refreshGuestToken, getGuestTokenRefreshTiming(newGuestToken));
  }

  setTimeout(refreshGuestToken, getGuestTokenRefreshTiming(guestToken));

  function unmount() {
    log('unmounting');
    //@ts-ignore
    mountPoint.replaceChildren();
  }

  const getScrollSize = () => ourPort.get<Size>('getScrollSize');
  const getDashboardPermalink = (anchor: string) =>
    ourPort.get<string>('getDashboardPermalink', { anchor });
  const getActiveTabs = () => ourPort.get<string[]>('getActiveTabs')

  return {
    getScrollSize,
    unmount,
    getDashboardPermalink,
    getActiveTabs,
  };
}
