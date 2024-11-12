/*
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

import {
  Encodable,
  ColorSchemeResolver,
  TimeFormatResolver,
  CategoricalColorScaleResolver,
  defaultColorSchemeResolver,
  addPrefix,
} from 'encodable';
import {
  CategoricalColorNamespace,
  getCategoricalSchemeRegistry,
  getSequentialSchemeRegistry,
  getNumberFormatter,
  getTimeFormatter,
  LOCAL_PREFIX,
  getTimeFormatterRegistry,
} from '@superset-ui/core';

const timeFormat: TimeFormatResolver = ({
  format,
  formatInLocalTime = false,
} = {}) => {
  const formatString = formatInLocalTime
    ? addPrefix(
        LOCAL_PREFIX,
        format ?? getTimeFormatterRegistry().getDefaultKey()!,
      )
    : format;

  return getTimeFormatter(formatString);
};

const colorSchemeResolver: ColorSchemeResolver = ({
  name,
  type = 'categorical',
} = {}) => {
  if (type === 'sequential') {
    const scheme = getSequentialSchemeRegistry().get(name);

    return typeof scheme === 'undefined'
      ? scheme
      : { type: 'sequential', ...scheme };
  }
  if (type === 'categorical') {
    const scheme = getCategoricalSchemeRegistry().get(name);

    return typeof scheme === 'undefined'
      ? scheme
      : { type: 'categorical', ...scheme };
  }
  return defaultColorSchemeResolver({ name, type });
};

const colorScaleResolver: CategoricalColorScaleResolver = ({
  name,
  namespace,
} = {}) => CategoricalColorNamespace.getScale(name, namespace);

export default function configureEncodable() {
  Encodable.setNumberFormatResolver(getNumberFormatter)
    .setTimeFormatResolver(timeFormat)
    .setColorSchemeResolver(colorSchemeResolver)
    .setCategoricalColorScaleResolver(colorScaleResolver);
}
