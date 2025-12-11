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
 * Type declarations for @apache-superset/core
 *
 * This declares the module types for the docs build. The actual implementation
 * is resolved via webpack alias to superset-frontend/packages/superset-core/src.
 *
 * Add type declarations here as components are added to @apache-superset/core.
 */
declare module '@apache-superset/core' {
  import type { AlertProps as AntdAlertProps } from 'antd/es/alert';
  import type { PropsWithChildren, FC } from 'react';

  // Alert component
  export type AlertProps = PropsWithChildren<Omit<AntdAlertProps, 'children'>>;
  export const Alert: FC<AlertProps>;
}
