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

import NumberFormatter from '../NumberFormatter';

export default function createLengthFormatter(config: {
  description?: string;
  id?: string;
  label?: string;
  convertType?: string;
}) {
  const { description, id, label, convertType } = config;

  return new NumberFormatter({
    description,
    formatFunc: value => {
      if (convertType === 'm => km') {
        return `${(value / 1000).toFixed(2).toString()}KM`;
      }
      if (convertType === 'cm => km') {
        return `${(value / 100_000).toFixed(2).toString()}KM`;
      }
      if (convertType === 'cm => m') {
        return `${(value / 100).toFixed(2).toString()}M`;
      }
      return value.toString();
    },
    id: id ?? 'length_format',
    label: label ?? `Length formatter`,
  });
}
