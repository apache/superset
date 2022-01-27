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
/** The type of an imported module. Don't fully understand this, yet. */
export declare type Module = any;
/**
 * Dependency management using global variables, because for the life of me
 * I can't figure out how to hook into UMD from a dynamically imported package.
 *
 * This defines a dynamically imported js module that can be used to import from
 * multiple different plugins.
 *
 * When importing a common module (such as react or lodash or superset-ui)
 * from a plugin, the plugin's build config will be able to
 * reference these globals instead of rebuilding them.
 *
 * @param name the module's name (should match name in package.json)
 * @param promise the promise resulting from a call to `import(name)`
 */
export declare function defineSharedModule(name: string, fetchModule: () => Promise<Module>): Promise<any>;
/**
 * Define multiple shared modules at once, using a map of name -> `import(name)`
 *
 * @see defineSharedModule
 * @param moduleMap
 */
export declare function defineSharedModules(moduleMap: {
    [key: string]: () => Promise<Module>;
}): Promise<any[]>;
export declare function reset(): void;
//# sourceMappingURL=shared-modules.d.ts.map