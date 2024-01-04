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
 * Types mirroring enums in `superset/reports/models.py`:
 */
export type ReportScheduleType = 'Alert' | 'Report';
export type ReportCreationMethod = 'charts' | 'dashboards' | 'alerts_reports';

export type ReportRecipientType = 'Email' | 'Slack';

export enum ReportType {
  DASHBOARDS = 'dashboards',
  CHARTS = 'charts',
}

export enum NOTIFICATION_FORMATS {
  TEXT = 'TEXT',
  PNG = 'PNG',
  CSV = 'CSV',
}
export interface ReportObject {
  id?: number;
  active: boolean;
  crontab: string;
  dashboard?: number;
  chart?: number;
  description?: string;
  log_retention: number;
  name: string;
  owners: number[];
  recipients: [
    { recipient_config_json: { target: string }; type: ReportRecipientType },
  ];
  report_format: string;
  timezone: string;
  type: ReportScheduleType;
  validator_config_json: {} | null;
  validator_type: string;
  working_timeout: number;
  creation_method: string;
  force_screenshot: boolean;
  custom_width?: number | null;
  error?: string;
}
