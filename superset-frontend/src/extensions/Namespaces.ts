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
 * Global `window.superset` type augmentation.
 *
 * Lives in its own module (rather than inline in ExtensionsStartup) so every
 * file that reads or writes `window.superset` — notably ExtensionsLoader —
 * sees the type regardless of how files are batched during compilation. Both
 * the startup component and the loader import this module for its side effect.
 */

import type {
  authentication,
  chat,
  commands,
  core,
  editors,
  extensions,
  menus,
  navigation,
  sqlLab,
  views,
} from 'src/core';

/** The host namespaces exposed to extensions on `window.superset`. */
export interface Namespaces {
  authentication: typeof authentication;
  core: typeof core;
  chat: typeof chat;
  commands: typeof commands;
  editors: typeof editors;
  extensions: typeof extensions;
  menus: typeof menus;
  navigation: typeof navigation;
  sqlLab: typeof sqlLab;
  views: typeof views;
}

declare global {
  interface Window {
    superset: Namespaces;
  }
}
