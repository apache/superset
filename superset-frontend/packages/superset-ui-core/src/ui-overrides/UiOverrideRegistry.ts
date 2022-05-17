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

/** A function (or component) which returns text (or marked-up text) */
type UiGeneratorText<P = void> = (props: P) => string | React.ReactElement;

/**
 * This type defines all the UI override options which replace elements of Superset's default UI.
 * Idea with the keys here is generally to namespace following the form of 'domain.functonality.item'
 *
 * When defining a new option here, take care to keep any parameters to functions (or components) minimal.
 * Any removal or alteration to a parameter will be considered a breaking change.
 */
export type UiOverrides = Partial<{
  'embedded.documentation.description': UiGeneratorText;
  'embedded.documentation.url': string;
}>;

/**
 * A registry containing UI customizations to replace elements of Superset's default UI.
 */
class UiOverrideRegistry extends TypedRegistry<UiOverrides> {
  name = 'UiOverrideRegistry';
}

export const getUiOverrideRegistry = makeSingleton(UiOverrideRegistry, {});
