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
 * @fileoverview Extension Sandbox Module
 *
 * This module provides secure sandboxing capabilities for Superset extensions.
 * It supports three tiers of trust:
 *
 * - **Tier 1 (core)**: Trusted extensions run in the main JavaScript context
 * - **Tier 2 (iframe)**: Semi-trusted extensions run in sandboxed iframes
 * - **Tier 3 (wasm)**: Untrusted logic runs in WASM sandboxes
 *
 * @example
 * ```typescript
 * // Using iframe sandbox for UI extensions
 * import { IframeSandbox } from 'src/extensions/sandbox';
 *
 * <IframeSandbox
 *   sandboxId="ext-123"
 *   extensionId="my-extension"
 *   extensionName="My Extension"
 *   config={{ trustLevel: 'iframe', permissions: ['sqllab:read'] }}
 * />
 *
 * // Using WASM sandbox for logic-only extensions
 * import { createWASMSandbox } from 'src/extensions/sandbox';
 *
 * const sandbox = await createWASMSandbox({
 *   sandboxId: 'calc-1',
 *   extensionId: 'calculator',
 *   code: 'function calculate(a, b) { return a + b; }',
 *   config: { trustLevel: 'wasm' },
 * });
 *
 * const result = await sandbox.execute('calculate', [1, 2]);
 * ```
 */

// Types
export * from './types';

// Sandbox Bridge (postMessage RPC)
export { SandboxBridge, SandboxBridgeClient } from './SandboxBridge';

// Iframe Sandbox (Tier 2)
export { IframeSandbox } from './IframeSandbox';

// Worker Sandbox (command-only extensions)
export { WorkerSandbox, createWorkerSandbox } from './WorkerSandbox';
export type { WorkerSandboxConfig } from './WorkerSandbox';

// WASM Sandbox (Tier 3)
export { WASMSandbox, createWASMSandbox } from './WASMSandbox';

// Host API Implementation
export { SandboxedExtensionHostImpl } from './SandboxedExtensionHost';

// Sandbox Manager
export { SandboxManager } from './SandboxManager';
export type { SandboxInstance } from './SandboxManager';

// Sandboxed Extension Renderer
export { SandboxedExtensionRenderer } from './SandboxedExtensionRenderer';
