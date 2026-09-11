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
import { ThemeMode } from '@apache-superset/core/theme';

/**
 * Reads the `?themeMode=` URL parameter from the iframe URL and returns
 * the corresponding ThemeMode. Falls back to ThemeMode.DEFAULT when the
 * param is absent or unrecognised.
 *
 * Host apps set this via `dashboardUiConfig.urlParams.themeMode` in the
 * embed SDK, which forwards it to the iframe URL automatically.
 */
export function getInitialThemeMode(): ThemeMode {
  const params = new URLSearchParams(window.location.search);
  const themeMode = params.get('themeMode');
  if (themeMode === 'dark') return ThemeMode.DARK;
  if (themeMode === 'system') return ThemeMode.SYSTEM;
  return ThemeMode.DEFAULT;
}
