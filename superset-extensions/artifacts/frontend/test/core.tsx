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

/**
 * @fileoverview A stand-in for the parts of `@apache-superset/core` the
 * extension calls, which the host provides at runtime.
 */

import type { ReactNode } from 'react';

export const translation = {
  t: (text: string, ...args: unknown[]) =>
    args.reduce<string>((out, arg) => out.replace('%s', String(arg)), text),
};

export const components = {
  Alert: ({ children }: { children?: ReactNode }) => (
    <div role="alert">{children}</div>
  ),
};

export const theme = {
  useTheme: () => ({ colorPrimary: '#20a7c9' }),
  isThemeDark: () => false,
};

export const authentication = {
  getCSRFToken: async () => 'csrf-token',
};

export const canvas = { registerWidgetRenderer: () => undefined };

export const views = { registerView: () => undefined };
