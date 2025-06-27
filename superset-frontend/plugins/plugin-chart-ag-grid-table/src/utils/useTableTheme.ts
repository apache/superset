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
import { useTheme } from '@superset-ui/core';
import {
  colorSchemeDark,
  colorSchemeLight,
  themeQuartz,
} from 'ag-grid-community';
// eslint-disable-next-line import/no-extraneous-dependencies
import tinycolor from 'tinycolor2';

export const useIsDark = () => {
  const theme = useTheme();
  return tinycolor(theme.colorBgContainer).isDark();
};

const useTableTheme = () => {
  const baseTheme = themeQuartz;
  const isDarkTheme = useIsDark();
  const tableTheme = isDarkTheme
    ? baseTheme.withPart(colorSchemeDark)
    : baseTheme.withPart(colorSchemeLight);
  return tableTheme;
};

export default useTableTheme;
