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

// Null module shim for packages not available in the docs build.
// These are transitive dependencies of superset-frontend components that exist
// in the barrel file but are never rendered on the docs site.
// webpack needs these to resolve at build time even though the code paths
// that use them are never executed at runtime.
//
// This shim uses a recursive Proxy to handle nested property access chains:
//   import ace from 'ace-builds'; ace.config.set(...) → works (returns proxy)
//   import { useResizeDetector } from 'react-resize-detector' → returns noop hook
//   import ReactAce from 'react-ace' → returns NullComponent

const NullComponent = () => null;

// For hooks that return objects/arrays
const useNoop = () => ({});

// Mock for useResizeDetector - returns { ref, width, height } where ref.current exists
const useResizeDetectorMock = () => ({
  ref: { current: null },
  width: 0,
  height: 0,
});

/**
 * Creates a recursive proxy that handles any depth of property access.
 * This allows patterns like ace.config.set() or ace.config.setModuleUrl() to work.
 *
 * The proxy is both callable (returns undefined) and accessible (returns another proxy).
 */
function createDeepProxy() {
  const handler = {
    // Handle property access - return another proxy for chaining
    get(target, prop) {
      // Standard module properties
      if (prop === 'default') return createDeepProxy();
      if (prop === '__esModule') return true;

      // Symbol properties (used by JS internals)
      if (typeof prop === 'symbol') {
        if (prop === Symbol.toPrimitive) return () => '';
        if (prop === Symbol.toStringTag) return 'NullModule';
        if (prop === Symbol.iterator) return undefined;
        return undefined;
      }

      // React-specific properties
      if (prop === '$$typeof') return undefined;
      if (prop === 'propTypes') return undefined;
      if (prop === 'displayName') return 'NullComponent';

      // Specific hook mocks for known hooks that need proper return values
      if (prop === 'useResizeDetector') {
        return useResizeDetectorMock;
      }

      // Common hook names return useNoop for better compatibility
      if (typeof prop === 'string' && prop.startsWith('use')) {
        return useNoop;
      }

      // Return another proxy to allow further chaining (ace.config.set)
      return createDeepProxy();
    },

    // Handle function calls - return undefined (safe default)
    apply() {
      return undefined;
    },

    // Handle new ClassName() - return an empty object
    construct() {
      return {};
    },
  };

  // Create a proxy over a function so it's both callable and has properties
  return new Proxy(function NullModule() {}, handler);
}

// Create the main module export as a deep proxy
const nullModule = createDeepProxy();

// Support both CommonJS and ES module patterns
module.exports = nullModule;
module.exports.default = createDeepProxy();
module.exports.__esModule = true;

// Named exports for common patterns (webpack may inline these)
module.exports.useResizeDetector = useResizeDetectorMock;
module.exports.withResizeDetector = createDeepProxy();
module.exports.Resizable = NullComponent;
module.exports.ResizableBox = NullComponent;
module.exports.FixedSizeList = NullComponent;
module.exports.VariableSizeList = NullComponent;

// ace-builds specific exports that CodeEditor uses
module.exports.config = createDeepProxy();
module.exports.require = createDeepProxy();
module.exports.edit = createDeepProxy();
