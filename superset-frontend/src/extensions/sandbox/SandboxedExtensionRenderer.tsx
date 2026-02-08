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
 * @fileoverview SandboxedExtensionRenderer component.
 *
 * This component renders a sandboxed extension in an iframe with proper
 * lifecycle management and bridge connection.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { logging } from '@apache-superset/core';
import { IframeSandbox } from './IframeSandbox';
import { SandboxManager } from './SandboxManager';
import { SandboxConfig, SandboxError } from './types';

/**
 * Props for the SandboxedExtensionRenderer component.
 */
interface SandboxedExtensionRendererProps {
  /** Extension ID to render */
  extensionId: string;
  /** Extension name for display */
  extensionName: string;
  /** Sandbox configuration */
  config: SandboxConfig;
  /** URL to the extension's entry point */
  entryUrl?: string;
  /** Inline HTML content (alternative to entryUrl) */
  inlineContent?: string;
  /** Callback when sandbox is ready */
  onReady?: () => void;
  /** Callback when sandbox encounters an error */
  onError?: (error: SandboxError) => void;
  /** Additional CSS class name */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
}

/**
 * Renders a sandboxed extension with proper lifecycle management.
 *
 * @remarks
 * This component:
 * 1. Creates a sandbox instance via SandboxManager
 * 2. Renders the IframeSandbox component
 * 3. Connects the sandbox when the iframe is ready
 * 4. Cleans up on unmount
 *
 * @example
 * ```tsx
 * <SandboxedExtensionRenderer
 *   extensionId="sqllab_parquet_sandboxed"
 *   extensionName="Export to Parquet"
 *   config={{
 *     trustLevel: 'iframe',
 *     permissions: ['sqllab:read', 'notification:show'],
 *   }}
 *   onReady={() => console.log('Extension ready')}
 * />
 * ```
 */
export function SandboxedExtensionRenderer({
  extensionId,
  extensionName,
  config,
  entryUrl,
  inlineContent,
  onReady,
  onError,
  className,
  style,
}: SandboxedExtensionRendererProps) {
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const sandboxManager = SandboxManager.getInstance();

  // Create sandbox instance on mount
  useEffect(() => {
    const newSandboxId = sandboxManager.createSandbox(extensionId, config);
    setSandboxId(newSandboxId);

    logging.info(
      `SandboxedExtensionRenderer: Created sandbox ${newSandboxId} for ${extensionId}`,
    );

    // Cleanup on unmount
    return () => {
      sandboxManager.disposeSandbox(newSandboxId);
    };
  }, [extensionId, config, sandboxManager]);

  // Handle iframe ready
  const handleReady = useCallback(() => {
    if (sandboxId && iframeRef.current) {
      sandboxManager.connectSandbox(sandboxId, iframeRef.current);
    }
    onReady?.();
  }, [sandboxId, sandboxManager, onReady]);

  // Handle errors
  const handleError = useCallback(
    (error: SandboxError) => {
      logging.error(`Sandbox error for ${extensionId}:`, error);
      onError?.(error);
    },
    [extensionId, onError],
  );

  // Store iframe ref when IframeSandbox renders
  const handleIframeRef = useCallback((iframe: HTMLIFrameElement | null) => {
    iframeRef.current = iframe;
  }, []);

  if (!sandboxId) {
    return null;
  }

  return (
    <IframeSandboxWithRef
      ref={handleIframeRef}
      sandboxId={sandboxId}
      extensionId={extensionId}
      extensionName={extensionName}
      entryUrl={entryUrl}
      inlineContent={inlineContent}
      config={config}
      onReady={handleReady}
      onError={handleError}
      className={className}
      style={style}
    />
  );
}

/**
 * Wrapper to expose iframe ref from IframeSandbox.
 *
 * Since IframeSandbox manages its own ref internally, we need a way to
 * get access to the iframe element for the SandboxManager connection.
 */
import { forwardRef, useImperativeHandle } from 'react';

interface IframeSandboxWithRefProps {
  sandboxId: string;
  extensionId: string;
  extensionName: string;
  entryUrl?: string;
  inlineContent?: string;
  config: SandboxConfig;
  onReady?: () => void;
  onError?: (error: SandboxError) => void;
  className?: string;
  style?: React.CSSProperties;
}

const IframeSandboxWithRef = forwardRef<
  HTMLIFrameElement | null,
  IframeSandboxWithRefProps
>(function IframeSandboxWithRef(
  {
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
  },
  ref,
) {
  const internalRef = useRef<HTMLIFrameElement | null>(null);

  // Expose the iframe element via the forwarded ref
  useImperativeHandle(ref, () => internalRef.current as HTMLIFrameElement, []);

  // We need to intercept the onReady to get the iframe ref
  const handleReady = useCallback(() => {
    // Find the iframe in the DOM (IframeSandbox creates it)
    const container = document.querySelector(
      `[data-sandbox-id="${sandboxId}"]`,
    );
    const iframe = container?.querySelector('iframe');
    if (iframe) {
      internalRef.current = iframe as HTMLIFrameElement;
    }
    onReady?.();
  }, [sandboxId, onReady]);

  return (
    <div data-sandbox-id={sandboxId} className={className} style={style}>
      <IframeSandbox
        sandboxId={sandboxId}
        extensionId={extensionId}
        extensionName={extensionName}
        entryUrl={entryUrl}
        inlineContent={inlineContent}
        config={config}
        onReady={handleReady}
        onError={onError}
      />
    </div>
  );
});

export default SandboxedExtensionRenderer;
