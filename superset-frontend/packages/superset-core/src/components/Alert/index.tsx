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
import { Alert as AntdAlert } from 'antd';
import type { PropsWithChildren } from 'react';
import type { AlertProps as AntdAlertProps } from 'antd/es/alert';
import { t } from '../../translation';

/**
 * Props for the Alert component, extending Ant Design's AlertProps
 * with support for children instead of the message prop.
 */
export type AlertProps = PropsWithChildren<Omit<AntdAlertProps, 'children'>>;

/**
 * Alert component for displaying important messages to users.
 *
 * Wraps Ant Design's Alert component with sensible defaults and improved accessibility.
 * Supports four severity levels: success, info, warning, and error.
 *
 * @param props - Alert configuration props
 *
 * @example
 * // Basic usage with default info type
 * <Alert>This is an informational message</Alert>
 *
 * @example
 * // Error alert with description
 * <Alert type="error" description="Please try again later">
 *   Operation failed
 * </Alert>
 *
 * @example
 * // Success alert without close button or icon
 * <Alert type="success" closable={false} showIcon={false}>
 *   Settings saved successfully
 * </Alert>
 *
 * @example
 * // Warning alert with custom close handler
 * <Alert type="warning" onClose={() => console.log('Alert closed')}>
 *   Your session will expire in 5 minutes
 * </Alert>
 *
 * @returns Rendered Alert component with proper ARIA attributes
 */
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
      message={children || t('Default message')}
      description={description}
      {...rest}
    />
  );
};
