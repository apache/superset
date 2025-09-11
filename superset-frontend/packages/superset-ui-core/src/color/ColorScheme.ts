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

import { ColorSchemeGroup } from './types';

export interface ColorSchemeConfig {
  colors: string[];
  description?: string;
  id: string;
  label?: string;
  isDefault?: boolean;
  group?: ColorSchemeGroup;
}

export default class ColorScheme {
  colors: string[];

  description: string;

  id: string;

  label: string;

  isDefault?: boolean;

  group?: ColorSchemeGroup;

  constructor({
    colors,
    description = '',
    id,
    label,
    isDefault,
    group,
  }: ColorSchemeConfig) {
    this.id = id;
    this.label = label ?? id;
    this.colors = colors;
    this.description = description;
    this.isDefault = isDefault;
    this.group = group;
  }
}
