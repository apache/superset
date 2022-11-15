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
 * A function which returns text (or marked-up text)
 * If what you want is a react component, don't use this. Use React.ComponentType instead.
 */
type ReturningDisplayable<P = void> = (props: P) => string | React.ReactElement;

/**
 * This type defines all available extensions of Superset's default UI.
 * Namespace the keys here to follow the form of 'some_domain.functonality.item'.
 * Take care to name your keys well, as the name describes what this extension point's role is in Superset.
 *
 * When defining a new option here, take care to keep any parameters to functions (or components) minimal.
 * Any removal or alteration to a parameter will be considered a breaking change.
 */

// from src/views/components/Menu, not imported since this is a separate package
interface MenuObjectChildProps {
  label: string;
  name?: string;
  icon?: string;
  index?: number;
  url?: string;
  isFrontendRoute?: boolean;
  perm?: string | boolean;
  view?: string;
  disable?: boolean;
}

type ConfigDetailsProps = {
  embeddedId: string;
};
type RightMenuItemIconProps = {
  menuChild: MenuObjectChildProps;
};

export type Extensions = Partial<{
  'alertsreports.header.icon': React.ComponentType;
  'embedded.documentation.configuration_details': React.ComponentType<ConfigDetailsProps>;
  'embedded.documentation.description': ReturningDisplayable;
  'embedded.documentation.url': string;
  'dashboard.nav.right': React.ComponentType;
  'navbar.right-menu.item.icon': React.ComponentType<RightMenuItemIconProps>;
  'navbar.right': React.ComponentType;
  'report-modal.dropdown.item.icon': React.ComponentType;
  'welcome.message': React.ComponentType;
  'welcome.banner': React.ComponentType;
  'welcome.main.replacement': React.ComponentType;
}>;

/**
 * A registry containing extensions which can alter Superset's UI at specific points defined by Superset.
 * See SIP-87: https://github.com/apache/superset/issues/20615
 */
class ExtensionsRegistry extends TypedRegistry<Extensions> {
  name = 'ExtensionsRegistry';
}

export const getExtensionsRegistry = makeSingleton(ExtensionsRegistry, {});

// Exporting this under the old name for backwards compatibility.
// After downstream folks have migrated to `getExtensionsRegistry`, we should remove this.
export const getUiOverrideRegistry = getExtensionsRegistry;
