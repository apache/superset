(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /*
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

export default class LazyFactory {










  constructor(factoryFn) {this.activeNodes = new Map();this.factoryFn = void 0;
    this.factoryFn = factoryFn;
  }

  createInContainer(container = document.body) {
    if (this.activeNodes.has(container)) {
      const entry = this.activeNodes.get(container);
      entry.counter += 1;

      return entry.node;
    }

    const node = this.factoryFn();
    container.append(node);
    this.activeNodes.set(container, { counter: 1, node });

    return node;
  }

  removeFromContainer(container = document.body) {
    if (this.activeNodes.has(container)) {
      const entry = this.activeNodes.get(container);
      entry.counter -= 1;
      if (entry.counter === 0) {
        container.removeChild(entry.node);
        this.activeNodes.delete(container);
      }
    }
  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(LazyFactory, "LazyFactory", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/dimension/svg/LazyFactory.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();