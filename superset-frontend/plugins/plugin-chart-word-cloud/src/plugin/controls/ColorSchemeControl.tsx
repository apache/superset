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
import { getCategoricalSchemeRegistry } from '@superset-ui/core';
import InternalColorSchemeControl from './ColorSchemeControl/index';
import { ColorSchemes } from './ColorSchemeControl/index';
// NOTE: We copied the Explore ColorSchemeControl into this plugin to avoid
// pulling the entire frontend src tree into this package’s tsconfig (importing
// from src/ was dragging in fixtures, tests, and other plugins). Keep this copy
// in sync with upstream changes, and consider moving it into a shared package
// once the control-panel refactor settles so all consumers can reuse it.
import { ControlComponentProps } from '@superset-ui/chart-controls';

type ColorSchemeControlWrapperProps = ControlComponentProps<string> & {
  clearable?: boolean;
};

export default function ColorSchemeControlWrapper({
  name = 'color_scheme',
  value,
  onChange,
  clearable = true,
  label,
  description,
  ...rest
}: ColorSchemeControlWrapperProps) {
  const categoricalSchemeRegistry = getCategoricalSchemeRegistry();
  const choices = categoricalSchemeRegistry.keys().map(s => [s, s]);
  const schemes = categoricalSchemeRegistry.getMap() as ColorSchemes;

  return (
    <InternalColorSchemeControl
      name={name}
      value={value ?? ''}
      onChange={onChange}
      clearable={clearable}
      choices={choices}
      schemes={schemes}
      hasCustomLabelsColor={false}
      label={typeof label === 'string' ? label : undefined}
      description={typeof description === 'string' ? description : undefined}
      {...rest}
    />
  );
}

ColorSchemeControlWrapper.displayName = 'ColorSchemeControlWrapper';
