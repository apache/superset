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

import React from 'react';
import { TypedRegistry } from '../models';
import { makeSingleton } from '../utils';

/**
 * A function (or component) which returns text (or marked-up text)
 * This != React.ComponentType. Use that when you want a react component.
 */
type ReturningDisplayable<P = void> = (props: P) => string | React.ReactElement;

/**
 * This type defines all the UI override options which replace elements of Superset's default UI.
 * Namespace the keys here to follow the form of 'some_domain.functonality.item'.
 * Take care to name your keys well, as the name describes what this extension point's role is in Superset.
 *
 * When defining a new option here, take care to keep any parameters to functions (or components) minimal.
 * Any removal or alteration to a parameter will be considered a breaking change.
 */
export type Extensions = Partial<{
  'embedded.documentation.description': ReturningDisplayable;
  'embedded.documentation.url': string;
  'navbar.right': React.ComponentType;
  'welcome.banner': React.ComponentType;
}>;

/**
 * A registry containing extensions which can alter Superset's UI at specific points defined by Superset.
 * See SIP-87: 
 */
class ExtensionsRegistry extends TypedRegistry<Extensions> {
  name = 'UiOverrideRegistry';
}

export const getExtensionsRegistry = makeSingleton(ExtensionsRegistry, {});

// Exporting this under the old name for backwards compatibility.
// After the SIP-87 vote passes it should be safe to remove this.
export const getUiOverrideRegistry = getExtensionsRegistry;
