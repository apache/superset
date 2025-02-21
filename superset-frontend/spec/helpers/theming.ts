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
import { mount as enzymeMount } from 'enzyme';
// eslint-disable-next-line no-restricted-imports
import { supersetTheme } from '@superset-ui/core';
import { ReactElement } from 'react';
import { ProviderWrapper } from './ProviderWrapper';

type optionsType = {
  wrappingComponentProps?: any;
  wrappingComponent?: ReactElement;
  context?: any;
  newOption?: string;
};

export function styledMount(
  component: ReactElement,
  options: optionsType = {},
): any {
  return enzymeMount(component, {
    ...options,
    wrappingComponent: ProviderWrapper,
    wrappingComponentProps: {
      theme: supersetTheme,
      ...options?.wrappingComponentProps,
    },
  });
}
