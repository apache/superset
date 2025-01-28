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
/* eslint-env browser */
import { getCategoricalSchemeRegistry, t } from '@superset-ui/core';
import ColorSchemeControl from 'src/explore/components/controls/ColorSchemeControl';

const ColorSchemeControlWrapper = ({
  colorScheme,
  labelMargin = 0,
  hasCustomLabelsColor = false,
  onChange = () => {},
}) => {
  // Registry initialization
  const categoricalSchemeRegistry = getCategoricalSchemeRegistry();
  const choices = categoricalSchemeRegistry.keys().map(s => [s, s]);
  const schemes = categoricalSchemeRegistry.getMap();

  return (
    <ColorSchemeControl
      description={t(
        "Any color palette selected here will override the colors applied to this dashboard's individual charts",
      )}
      labelMargin={labelMargin}
      name="color_scheme"
      onChange={onChange}
      value={colorScheme}
      choices={choices}
      clearable
      schemes={schemes}
      hasCustomLabelsColor={hasCustomLabelsColor}
    />
  );
};

export default ColorSchemeControlWrapper;
