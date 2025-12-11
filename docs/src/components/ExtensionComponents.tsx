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
 * Extension component wrappers for documentation.
 *
 * These components mirror the @apache-superset/core API so that
 * documentation examples work correctly. When new components are
 * added to @apache-superset/core, corresponding wrappers should
 * be added here.
 */

import React from 'react';
import { Alert as AntdAlert } from 'antd';
import type { AlertProps as AntdAlertProps } from 'antd/es/alert';

/**
 * Alert component wrapper matching the @apache-superset/core API.
 */
type AlertProps = React.PropsWithChildren<Omit<AntdAlertProps, 'children'>>;

export const Alert = (props: AlertProps) => {
  const {
    type = 'info',
    description,
    showIcon = true,
    closable = true,
    children,
    ...rest
  } = props;
  return (
    <AntdAlert
      role="alert"
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      type={type}
      showIcon={showIcon}
      closable={closable}
      message={children || 'Default message'}
      description={description}
      {...rest}
    />
  );
};
