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
 * @fileoverview WASM Sandbox for Tier 3 logic-only extensions.
 *
 * This module provides a secure execution environment for untrusted JavaScript
 * code using QuickJS compiled to WebAssembly. Extensions running in this sandbox
 * have no access to the DOM, network, or browser APIs - only explicitly injected
 * functions are available.
 *
 * @remarks
 * This sandbox is intended for:
 * - Custom data transformations
 * - Calculated fields and formatters
 * - Data validation rules
 * - Custom aggregation functions
 *
 * It is NOT suitable for extensions that need to render UI.
 */

import { logging } from '@apache-superset/core';
import type {
  QuickJSWASMModule,
  QuickJSRuntime,
  QuickJSContext,
  QuickJSHandle,
} from 'quickjs-emscripten';
import {
  WASMSandboxConfig,
  WASMExecutionResult,
  WASMResourceLimits,
} from './types';

/**
 * Default resource limits for WASM sandbox execution.
 */
const DEFAULT_RESOURCE_LIMITS: Required<WASMResourceLimits> = {
  maxMemory: 10 * 1024 * 1024, // 10MB
  maxExecutionTime: 5000, // 5 seconds
  maxStackSize: 1000,
};

// Lazy-loaded QuickJS module
let quickJSPromise: Promise<QuickJSWASMModule> | null = null;

/**
 * Lazily load the QuickJS WebAssembly module.
 *
 * @remarks
 * This function loads quickjs-emscripten on demand to avoid
 * bundling the WASM file when not needed.
 */
async function loadQuickJS(): Promise<QuickJSWASMModule> {
  if (!quickJSPromise) {
    quickJSPromise = (async () => {
      try {
        // Dynamic import to avoid bundling when not used
        const { getQuickJS } = await import('quickjs-emscripten');
        return getQuickJS();
      } catch (error) {
        logging.error('Failed to load QuickJS:', error);
        throw new Error(
          'QuickJS WASM module not available. Install quickjs-emscripten to use WASM sandboxing.',
        );
      }
    })();
  }
  return quickJSPromise;
}

/**
 * WASM Sandbox for executing untrusted JavaScript code securely.
 *
 * @remarks
 * This class provides a secure execution environment using QuickJS
 * compiled to WebAssembly. Key features:
 *
 * - Complete isolation from browser APIs
 * - Memory limits to prevent DoS
 * - Execution time limits
 * - Only explicitly injected APIs are available
 *
 * @example
 * ```typescript
 * const sandbox = new WASMSandbox({
 *   sandboxId: 'transformer-1',
 *   extensionId: 'my-extension',
 *   code: `
 *     function transform(data) {
 *       return data.map(row => ({ ...row, computed: row.a + row.b }));
 *     }
 *   `,
 *   config: { trustLevel: 'wasm' },
 *   injectedAPIs: {
 *     formatNumber: (n, decimals) => n.toFixed(decimals),
 *   },
 * });
 *
 * await sandbox.initialize();
 * const result = await sandbox.execute('transform', [[{ a: 1, b: 2 }]]);
 * sandbox.dispose();
 * ```
 */
export class WASMSandbox {
  private config: WASMSandboxConfig;

  private runtime: QuickJSRuntime | null = null;

  private context: QuickJSContext | null = null;

  private resourceLimits: Required<WASMResourceLimits>;

  private isInitialized = false;

  private executionStartTime = 0;

  constructor(config: WASMSandboxConfig) {
    this.config = config;
    this.resourceLimits = {
      ...DEFAULT_RESOURCE_LIMITS,
      ...config.config.resourceLimits,
    };
  }

  /**
   * Initialize the sandbox environment.
   *
   * @remarks
   * This loads the QuickJS WASM module, creates a runtime with resource
   * limits, and evaluates the extension code.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const QuickJS = await loadQuickJS();

    // Create runtime with memory limit
    this.runtime = QuickJS.newRuntime();
    this.runtime.setMemoryLimit(this.resourceLimits.maxMemory);

    // Set up interrupt handler for execution time limit
    this.runtime.setInterruptHandler(() => {
      const elapsed = Date.now() - this.executionStartTime;
      return elapsed > this.resourceLimits.maxExecutionTime;
    });

    // Create context
    this.context = this.runtime.newContext();

    // Inject APIs
    this.injectAPIs();

    // Evaluate the extension code
    try {
      const result = this.context.evalCode(this.config.code);
      if (result.error) {
        const errorValue = this.context.dump(result.error);
        result.error.dispose();
        throw new Error(`Code evaluation failed: ${String(errorValue)}`);
      }
      result.value.dispose();
    } catch (error) {
      this.dispose();
      throw error;
    }

    this.isInitialized = true;
    logging.info(`WASMSandbox ${this.config.sandboxId} initialized`);
  }

  /**
   * Execute a function defined in the sandboxed code.
   *
   * @param functionName - Name of the function to call
   * @param args - Arguments to pass to the function
   * @returns Execution result including timing and memory info
   */
  async execute(
    functionName: string,
    args: unknown[] = [],
  ): Promise<WASMExecutionResult> {
    if (!this.isInitialized || !this.context) {
      return {
        success: false,
        error: {
          code: 'NOT_INITIALIZED',
          message: 'Sandbox is not initialized',
        },
        executionTime: 0,
        memoryUsed: 0,
      };
    }

    this.executionStartTime = Date.now();

    try {
      // Get the function from global scope
      const fnHandle = this.context.getProp(this.context.global, functionName);

      if (this.context.typeof(fnHandle) !== 'function') {
        fnHandle.dispose();
        return {
          success: false,
          error: {
            code: 'FUNCTION_NOT_FOUND',
            message: `Function '${functionName}' not found in sandbox`,
          },
          executionTime: Date.now() - this.executionStartTime,
          memoryUsed: 0,
        };
      }

      fnHandle.dispose();

      // Build call expression with JSON-serialized args
      const argsJson = JSON.stringify(args);
      const callCode = `${functionName}.apply(null, ${argsJson})`;

      const resultHandle = this.context.evalCode(callCode);

      if (resultHandle.error) {
        const errorValue = this.context.dump(resultHandle.error);
        resultHandle.error.dispose();
        return {
          success: false,
          error: {
            code: 'EXECUTION_ERROR',
            message: String(errorValue),
          },
          executionTime: Date.now() - this.executionStartTime,
          memoryUsed: 0,
        };
      }

      const result = this.context.dump(resultHandle.value);
      resultHandle.value.dispose();

      return {
        success: true,
        result,
        executionTime: Date.now() - this.executionStartTime,
        memoryUsed: 0, // QuickJS doesn't expose memory usage directly
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Check if it was an interrupt (timeout)
      if (errorMessage.includes('interrupted')) {
        return {
          success: false,
          error: {
            code: 'TIMEOUT',
            message: `Execution exceeded ${this.resourceLimits.maxExecutionTime}ms limit`,
          },
          executionTime: Date.now() - this.executionStartTime,
          memoryUsed: 0,
        };
      }

      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: errorMessage,
        },
        executionTime: Date.now() - this.executionStartTime,
        memoryUsed: 0,
      };
    }
  }

  /**
   * Dispose of the sandbox and free resources.
   */
  dispose(): void {
    if (this.context) {
      this.context.dispose();
      this.context = null;
    }

    if (this.runtime) {
      this.runtime.dispose();
      this.runtime = null;
    }

    this.isInitialized = false;
    logging.info(`WASMSandbox ${this.config.sandboxId} disposed`);
  }

  /**
   * Check if the sandbox is initialized.
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Inject safe APIs into the sandbox context.
   */
  private injectAPIs(): void {
    if (!this.context) {
      return;
    }

    const ctx = this.context;

    // Inject custom APIs provided in config
    if (this.config.injectedAPIs) {
      const apisObj = ctx.newObject();

      for (const [name, fn] of Object.entries(this.config.injectedAPIs)) {
        if (typeof fn === 'function') {
          const wrappedFn = ctx.newFunction(name, (...handles: QuickJSHandle[]) => {
            const fnArgs = handles.map(h => ctx.dump(h));
            const fnResult = (fn as (...args: unknown[]) => unknown)(...fnArgs);
            return this.jsToQuickJS(fnResult);
          });
          ctx.setProp(apisObj, name, wrappedFn);
          wrappedFn.dispose();
        }
      }

      ctx.setProp(ctx.global, 'superset', apisObj);
      apisObj.dispose();
    }

    // Inject safe built-in utilities
    this.injectSafeBuiltins();
  }

  /**
   * Inject safe built-in functions.
   *
   * @remarks
   * We only inject functions that are safe and useful for data transformations.
   * No network, DOM, or timer APIs are available.
   */
  private injectSafeBuiltins(): void {
    if (!this.context) {
      return;
    }

    const ctx = this.context;

    // console.log for debugging (outputs to host console)
    const consoleObj = ctx.newObject();

    const logFn = ctx.newFunction('log', (...handles: QuickJSHandle[]) => {
      const logArgs = handles.map(h => ctx.dump(h));
      logging.info(`[WASMSandbox ${this.config.sandboxId}]`, ...logArgs);
      return ctx.undefined;
    });
    ctx.setProp(consoleObj, 'log', logFn);
    logFn.dispose();

    const warnFn = ctx.newFunction('warn', (...handles: QuickJSHandle[]) => {
      const warnArgs = handles.map(h => ctx.dump(h));
      logging.warn(`[WASMSandbox ${this.config.sandboxId}]`, ...warnArgs);
      return ctx.undefined;
    });
    ctx.setProp(consoleObj, 'warn', warnFn);
    warnFn.dispose();

    const errorFn = ctx.newFunction('error', (...handles: QuickJSHandle[]) => {
      const errorArgs = handles.map(h => ctx.dump(h));
      logging.error(`[WASMSandbox ${this.config.sandboxId}]`, ...errorArgs);
      return ctx.undefined;
    });
    ctx.setProp(consoleObj, 'error', errorFn);
    errorFn.dispose();

    ctx.setProp(ctx.global, 'console', consoleObj);
    consoleObj.dispose();
  }

  /**
   * Convert a JavaScript value to a QuickJS handle.
   */
  private jsToQuickJS(value: unknown): QuickJSHandle {
    if (!this.context) {
      throw new Error('Context not initialized');
    }

    const ctx = this.context;

    if (value === undefined) {
      return ctx.undefined;
    }

    if (value === null) {
      return ctx.null;
    }

    if (typeof value === 'string') {
      return ctx.newString(value);
    }

    if (typeof value === 'number') {
      return ctx.newNumber(value);
    }

    if (typeof value === 'boolean') {
      return value ? ctx.true : ctx.false;
    }

    if (Array.isArray(value)) {
      const arr = ctx.newArray();
      value.forEach((item, index) => {
        const itemHandle = this.jsToQuickJS(item);
        ctx.setProp(arr, index, itemHandle);
        itemHandle.dispose();
      });
      return arr;
    }

    if (typeof value === 'object') {
      const obj = ctx.newObject();
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        const valHandle = this.jsToQuickJS(val);
        ctx.setProp(obj, key, valHandle);
        valHandle.dispose();
      }
      return obj;
    }

    // For unsupported types, convert to string
    return ctx.newString(String(value));
  }
}

/**
 * Factory function to create and initialize a WASM sandbox.
 *
 * @param config - Sandbox configuration
 * @returns Initialized WASMSandbox instance
 */
export async function createWASMSandbox(
  config: WASMSandboxConfig,
): Promise<WASMSandbox> {
  const sandbox = new WASMSandbox(config);
  await sandbox.initialize();
  return sandbox;
}

export default WASMSandbox;
