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
import React from 'react';
import Alert, { AlertProps, AlertType } from './index';

export default {
  title: 'Superset Frontend/Components/Feedback/Alert/Examples',
  component: Alert,
};

const sharedAlertProps = {
  closable: true,
  roomBelow: false,
  description: `This is the optional description text to provide the user with more context about the alert`,
  showIcon: true,
  onClose: () => {
    // eslint-disable-next-line no-alert
    alert('Alert onClose callback invoked');
  },
};

export const InfoAlert = (args: AlertProps) => <Alert {...args} />;

InfoAlert.args = {
  ...sharedAlertProps,
  message: 'This is an info alert',
  type: AlertType.INFO,
};

export const WarningAlert = (args: AlertProps) => <Alert {...args} />;

WarningAlert.args = {
  ...sharedAlertProps,
  message: 'This is a warning alert',
  type: AlertType.WARNING,
};

export const ErrorAlert = (args: AlertProps) => <Alert {...args} />;

ErrorAlert.args = {
  ...sharedAlertProps,
  message: 'This is an error alert',
  type: AlertType.ERROR,
};

export const SuccessAlert = (args: AlertProps) => <Alert {...args} />;

SuccessAlert.args = {
  ...sharedAlertProps,
  message: 'This is a success alert',
  type: AlertType.SUCCESS,
};
