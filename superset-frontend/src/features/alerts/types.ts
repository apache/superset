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

import Owner from 'src/types/Owner';
import { NotificationFormats } from 'src/features/reports/types';

type user = {
  id: number;
  first_name: string;
  last_name: string;
};
export type ChartObject = {
  id: number;
  slice_name: string;
  viz_type: string;
};

export type DashboardObject = {
  dashboard_title: string;
  id: number;
};

export type DatabaseObject = {
  database_name: string;
  id: number;
};

export enum NotificationMethodOption {
  Email = 'Email',
  Slack = 'Slack',
  SlackV2 = 'SlackV2',
}

export type NotificationSetting = {
  method?: NotificationMethodOption;
  recipients: string;
  cc?: string;
  bcc?: string;
  options: NotificationMethodOption[];
};

export type SlackChannel = {
  id: string;
  name: string;
  is_member: boolean;
  is_private: boolean;
};

export type Recipient = {
  recipient_config_json: {
    target: string;
    ccTarget?: string;
    bccTarget?: string;
  };
  type: NotificationMethodOption;
};

export type MetaObject = {
  id?: number;
  label?: string;
  value?: number | string;
};

export type Operator = '<' | '>' | '<=' | '>=' | '==' | '!=' | 'not null';

export type AlertObject = {
  active?: boolean;
  creation_method?: string;
  chart?: MetaObject;
  changed_by?: user;
  changed_on_delta_humanized?: string;
  chart_id: number;
  created_by?: user;
  created_on?: string;
  crontab?: string;
  custom_width?: number | null;
  dashboard?: MetaObject;
  dashboard_id?: number;
  database?: MetaObject;
  description?: string;
  email_subject?: string;
  error?: string;
  force_screenshot: boolean;
  grace_period?: number;
  id: number;
  last_eval_dttm?: number;
  last_state?: 'Success' | 'Working' | 'Error' | 'Not triggered' | 'On Grace';
  log_retention?: number;
  name?: string;
  owners?: Array<Owner | MetaObject>;
  sql?: string;
  timezone?: string;
  recipients?: Array<Recipient>;
  report_format?: NotificationFormats;
  type?: string;
  validator_config_json?: {
    op?: Operator;
    threshold?: number;
  };
  validator_type?: string;
  working_timeout?: number;
};

export type LogObject = {
  end_dttm: string;
  error_message: string;
  id: number;
  scheduled_dttm: string;
  start_dttm: string;
  state: string;
  value: string;
  uuid: string;
};

export enum AlertState {
  Success = 'Success',
  Working = 'Working',
  Error = 'Error',
  Noop = 'Not triggered',
  Grace = 'On Grace',
}

export enum RecipientIconName {
  Email = 'Email',
  Slack = 'Slack',
  SlackV2 = 'SlackV2',
}
export interface AlertsReportsConfig {
  ALERT_REPORTS_DEFAULT_WORKING_TIMEOUT: number;
  ALERT_REPORTS_DEFAULT_RETENTION: number;
  ALERT_REPORTS_DEFAULT_CRON_VALUE: string;
}

export type SectionValidationObject = {
  hasErrors: boolean;
  errors: string[];
  name: string;
};

export interface ValidationObject {
  [key: string]: SectionValidationObject;
}

export enum Sections {
  General = 'generalSection',
  Content = 'contentSection',
  Alert = 'alertConditionSection',
  Schedule = 'scheduleSection',
  Notification = 'notificationSection',
}
