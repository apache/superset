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
import { shallow as enzymeShallow, mount as enzymeMount } from 'enzyme';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import { ReactElement } from 'react';

type optionsType = {
  wrappingComponentProps?: any;
  wrappingComponent?: ReactElement;
  context?: any;
};

export function styledMount(
  component: ReactElement,
  options: optionsType = {},
) {
  return enzymeMount(component, {
    ...options,
    wrappingComponent: ThemeProvider,
    wrappingComponentProps: {
      theme: supersetTheme,
      ...options?.wrappingComponentProps,
    },
  });
}

export function styledShallow(
  component: ReactElement,
  options: optionsType = {},
) {
  return enzymeShallow(component, {
    ...options,
    wrappingComponent: ThemeProvider,
    wrappingComponentProps: {
      theme: supersetTheme,
      ...options?.wrappingComponentProps,
    },
  }).dive();
}
