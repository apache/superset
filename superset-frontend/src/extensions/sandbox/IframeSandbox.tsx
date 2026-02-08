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

/**
 * @fileoverview IframeSandbox component for Tier 2 sandboxed extensions.
 *
 * This component renders a sandboxed iframe that hosts extension UI code
 * with browser-enforced isolation. Communication with the extension happens
 * via the SandboxBridge postMessage API.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { css, styled, SupersetTheme } from '@apache-superset/core/ui';
import { logging } from '@apache-superset/core';
import { SandboxBridge } from './SandboxBridge';
import {
  SandboxConfig,
  SandboxError,
  ContentSecurityPolicy,
} from './types';
import { SandboxedExtensionHostImpl } from './SandboxedExtensionHost';

/**
 * Props for the IframeSandbox component.
 */
interface IframeSandboxProps {
  /** Unique ID for this sandbox instance */
  sandboxId: string;
  /** Extension ID being sandboxed */
  extensionId: string;
  /** Extension name for display purposes */
  extensionName: string;
  /** URL to the extension's entry point */
  entryUrl?: string;
  /** Inline HTML content (alternative to entryUrl) */
  inlineContent?: string;
  /** Sandbox configuration */
  config: SandboxConfig;
  /** Callback when sandbox is ready */
  onReady?: () => void;
  /** Callback when sandbox encounters an error */
  onError?: (error: SandboxError) => void;
  /** Additional CSS class name */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
}

const SandboxContainer = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
`;

const SandboxIframe = styled.iframe`
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => (theme as SupersetTheme).colorBgContainer};
`;

const ErrorOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => (theme as SupersetTheme).colorBgContainer};
  color: ${({ theme }) => (theme as SupersetTheme).colorError};
  padding: ${({ theme }) => (theme as SupersetTheme).paddingLG}px;
  text-align: center;
`;

/**
 * Build Content Security Policy string from configuration.
 */
function buildCSP(csp?: ContentSecurityPolicy): string {
  const directives: string[] = [];

  // Start with restrictive defaults
  const defaultDirectives: ContentSecurityPolicy = {
    defaultSrc: ["'none'"],
    scriptSrc: ["'unsafe-inline'"], // Required for inline scripts in srcdoc
    styleSrc: ["'unsafe-inline'"], // Required for inline styles
    imgSrc: ['data:', 'blob:'],
    fontSrc: ['data:'],
    connectSrc: ["'none'"], // No network access by default
    frameSrc: ["'none'"],
    ...csp,
  };

  if (defaultDirectives.defaultSrc?.length) {
    directives.push(`default-src ${defaultDirectives.defaultSrc.join(' ')}`);
  }
  if (defaultDirectives.scriptSrc?.length) {
    directives.push(`script-src ${defaultDirectives.scriptSrc.join(' ')}`);
  }
  if (defaultDirectives.styleSrc?.length) {
    directives.push(`style-src ${defaultDirectives.styleSrc.join(' ')}`);
  }
  if (defaultDirectives.imgSrc?.length) {
    directives.push(`img-src ${defaultDirectives.imgSrc.join(' ')}`);
  }
  if (defaultDirectives.fontSrc?.length) {
    directives.push(`font-src ${defaultDirectives.fontSrc.join(' ')}`);
  }
  if (defaultDirectives.connectSrc?.length) {
    directives.push(`connect-src ${defaultDirectives.connectSrc.join(' ')}`);
  }
  if (defaultDirectives.frameSrc?.length) {
    directives.push(`frame-src ${defaultDirectives.frameSrc.join(' ')}`);
  }

  return directives.join('; ');
}

/**
 * Generate the HTML document to load in the sandboxed iframe.
 *
 * @remarks
 * This creates a minimal HTML document that:
 * 1. Sets up the Content Security Policy
 * 2. Includes the SandboxBridgeClient for communication
 * 3. Loads the extension's entry point
 */
function generateSandboxDocument(
  extensionId: string,
  extensionName: string,
  entryUrl?: string,
  inlineContent?: string,
  csp?: ContentSecurityPolicy,
): string {
  const cspString = buildCSP(csp);

  // The bridge client code that will be injected into the sandbox
  const bridgeClientCode = `
    // Minimal SandboxBridgeClient for communication with host
    class SandboxBridgeClient {
      constructor(extensionId) {
        this.extensionId = extensionId;
        this.pendingRequests = new Map();
        this.eventHandlers = new Map();
        this.callTimeout = 30000;
      }

      connect(parentWindow) {
        this.targetWindow = parentWindow;
        window.addEventListener('message', (e) => this.handleMessage(e));
        this.sendReady();
      }

      call(method, args = []) {
        return new Promise((resolve, reject) => {
          if (!this.targetWindow) {
            reject({ code: 'NOT_CONNECTED', message: 'Not connected' });
            return;
          }
          const id = Math.random().toString(36).slice(2);
          const timeout = setTimeout(() => {
            this.pendingRequests.delete(id);
            reject({ code: 'TIMEOUT', message: 'Call timed out' });
          }, this.callTimeout);
          this.pendingRequests.set(id, { resolve, reject, timeout });
          this.targetWindow.postMessage({
            type: 'api-call',
            id,
            extensionId: this.extensionId,
            method,
            args
          }, '*');
        });
      }

      on(eventName, handler) {
        if (!this.eventHandlers.has(eventName)) {
          this.eventHandlers.set(eventName, new Set());
        }
        this.eventHandlers.get(eventName).add(handler);
        return () => this.eventHandlers.get(eventName)?.delete(handler);
      }

      handleMessage(event) {
        const msg = event.data;
        if (!msg || msg.extensionId !== this.extensionId) return;
        if (msg.type === 'api-response') {
          const pending = this.pendingRequests.get(msg.id);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(msg.id);
            msg.error ? pending.reject(msg.error) : pending.resolve(msg.result);
          }
        } else if (msg.type === 'event') {
          const handlers = this.eventHandlers.get(msg.eventName);
          if (handlers) handlers.forEach(h => { try { h(msg.data); } catch(e) { console.error(e); }});
        }
      }

      sendReady() {
        if (!this.targetWindow) return;
        this.targetWindow.postMessage({
          type: 'ready',
          id: Math.random().toString(36).slice(2),
          extensionId: this.extensionId
        }, '*');
      }
    }

    // Command registry for extension commands
    const commandRegistry = new Map();

    // Initialize the bridge
    const superset = {
      bridge: new SandboxBridgeClient('${extensionId}'),

      // Command system
      commands: {
        register: (command, handler) => {
          commandRegistry.set(command, handler);
          return () => commandRegistry.delete(command);
        },
        execute: async (command, ...args) => {
          const handler = commandRegistry.get(command);
          if (handler) {
            return handler(...args);
          }
          console.warn('Command not found:', command);
          return undefined;
        },
      },

      // Convenience API wrappers
      sqlLab: {
        getCurrentTab: () => superset.bridge.call('sqlLab.getCurrentTab'),
        getQueryResults: (id) => superset.bridge.call('sqlLab.getQueryResults', [id]),
      },
      dashboard: {
        getContext: () => superset.bridge.call('dashboard.getContext'),
        getFilters: () => superset.bridge.call('dashboard.getFilters'),
      },
      chart: {
        getData: (id) => superset.bridge.call('chart.getData', [id]),
      },
      user: {
        getCurrentUser: () => superset.bridge.call('user.getCurrentUser'),
      },
      ui: {
        showNotification: (msg, type) => superset.bridge.call('ui.showNotification', [msg, type]),
        openModal: (config) => superset.bridge.call('ui.openModal', [config]),
        navigateTo: (path) => superset.bridge.call('ui.navigateTo', [path]),
      },
      utils: {
        copyToClipboard: (text) => superset.bridge.call('utils.copyToClipboard', [text]),
        downloadFile: (data, filename) => superset.bridge.call('utils.downloadFile', [data, filename]),
        getCSRFToken: () => superset.bridge.call('utils.getCSRFToken'),
      },
      on: (event, handler) => superset.bridge.on(event, handler),
    };

    // Connect to parent
    superset.bridge.connect(window.parent);

    // Listen for command events from the host
    superset.on('command', ({ command, args }) => {
      superset.commands.execute(command, ...(args || []));
    });

    // Make available globally
    window.superset = superset;
  `;

  // If inline content is provided, use it directly
  if (inlineContent) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="${cspString}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${extensionName}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>${bridgeClientCode}</script>
  ${inlineContent}
</body>
</html>`;
  }

  // Otherwise, load from URL
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="${cspString}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${extensionName}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>${bridgeClientCode}</script>
  ${entryUrl ? `<script src="${entryUrl}"></script>` : ''}
</body>
</html>`;
}

/**
 * IframeSandbox component for rendering sandboxed extensions.
 *
 * @remarks
 * This component creates a secure sandbox environment for running
 * untrusted extension code. The sandbox provides:
 *
 * - Browser-enforced isolation via iframe sandbox attribute
 * - Content Security Policy for resource restrictions
 * - postMessage-based API bridge for controlled host access
 * - Automatic cleanup on unmount
 *
 * @example
 * ```tsx
 * <IframeSandbox
 *   sandboxId="ext-123"
 *   extensionId="my-extension"
 *   extensionName="My Extension"
 *   config={{
 *     trustLevel: 'iframe',
 *     permissions: ['sqllab:read', 'notification:show'],
 *   }}
 *   onReady={() => console.log('Extension ready')}
 *   onError={(err) => console.error('Extension error:', err)}
 * />
 * ```
 */
export function IframeSandbox({
  sandboxId,
  extensionId,
  extensionName,
  entryUrl,
  inlineContent,
  config,
  onReady,
  onError,
  className,
  style,
}: IframeSandboxProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<SandboxBridge | null>(null);
  const hostImplRef = useRef<SandboxedExtensionHostImpl | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<SandboxError | null>(null);

  // Generate the sandbox document content
  const sandboxDocument = useMemo(
    () =>
      generateSandboxDocument(
        extensionId,
        extensionName,
        entryUrl,
        inlineContent,
        config.csp,
      ),
    [extensionId, extensionName, entryUrl, inlineContent, config.csp],
  );

  // Handle ready callback
  const handleReady = useCallback(() => {
    setIsLoading(false);
    logging.info(`IframeSandbox ${sandboxId} ready for extension ${extensionId}`);
    onReady?.();
  }, [sandboxId, extensionId, onReady]);

  // Handle error callback
  const handleError = useCallback(
    (err: SandboxError) => {
      setError(err);
      setIsLoading(false);
      logging.error(`IframeSandbox ${sandboxId} error:`, err);
      onError?.(err);
    },
    [sandboxId, onError],
  );

  // Set up the bridge when iframe loads
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return undefined;

    const handleLoad = () => {
      const contentWindow = iframe.contentWindow;
      if (!contentWindow) {
        handleError({
          code: 'NO_CONTENT_WINDOW',
          message: 'Failed to access iframe content window',
        });
        return;
      }

      // Create the bridge
      const bridge = new SandboxBridge({
        bridgeId: sandboxId,
        extensionId,
        permissions: config.permissions ?? [],
      });

      // Create the host API implementation
      const hostImpl = new SandboxedExtensionHostImpl(
        extensionId,
        config.permissions ?? [],
      );

      // Set up the API handler
      bridge.onApiCall(async (method: string, args: unknown[]) =>
        hostImpl.handleApiCall(method, args),
      );

      // Connect the bridge
      bridge.connect(contentWindow, handleReady);

      bridgeRef.current = bridge;
      hostImplRef.current = hostImpl;

      // Set a timeout for ready signal
      const readyTimeout = setTimeout(() => {
        if (isLoading) {
          handleError({
            code: 'READY_TIMEOUT',
            message: 'Extension did not signal ready within timeout',
          });
        }
      }, 10000);

      return () => clearTimeout(readyTimeout);
    };

    iframe.addEventListener('load', handleLoad);

    return () => {
      iframe.removeEventListener('load', handleLoad);
      bridgeRef.current?.disconnect();
      bridgeRef.current = null;
      hostImplRef.current = null;
    };
  }, [
    sandboxId,
    extensionId,
    config.permissions,
    handleReady,
    handleError,
    isLoading,
  ]);

  // Determine sandbox attribute value
  // We use 'allow-scripts' to let JS run, but NOT 'allow-same-origin'
  // which ensures the iframe cannot access the parent's cookies, storage, etc.
  const sandboxAttribute = 'allow-scripts';

  return (
    <SandboxContainer className={className} style={style}>
      <SandboxIframe
        ref={iframeRef}
        sandbox={sandboxAttribute}
        srcDoc={sandboxDocument}
        title={`Sandbox: ${extensionName}`}
        css={css`
          opacity: ${isLoading || error ? 0 : 1};
          transition: opacity 0.2s ease-in-out;
        `}
      />
      {isLoading && !error && (
        <LoadingOverlay>
          <span>Loading {extensionName}...</span>
        </LoadingOverlay>
      )}
      {error && (
        <ErrorOverlay>
          <strong>Extension Error</strong>
          <p>{error.message}</p>
          <small>Code: {error.code}</small>
        </ErrorOverlay>
      )}
    </SandboxContainer>
  );
}

export default IframeSandbox;
