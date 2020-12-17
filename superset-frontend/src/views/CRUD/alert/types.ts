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

type user = {
  id: number;
  first_name: string;
  last_name: string;
};

export type Recipient = {
  recipient_config_json: {
    target: string;
  };
  type: string;
};

export type MetaObject = {
  id?: number;
  label?: string;
  value?: number | string;
};

export type Operator = '<' | '>' | '<=' | '>=' | '==' | '!=' | 'not null';

export type AlertObject = {
  active?: boolean;
  chart?: MetaObject;
  changed_by?: user;
  changed_on_delta_humanized?: string;
  created_by?: user;
  created_on?: string;
  crontab?: string;
  dashboard?: MetaObject;
  database?: MetaObject;
  description?: string;
  grace_period?: number;
  id: number;
  last_eval_dttm?: number;
  last_state?: 'Success' | 'Working' | 'Error' | 'Not triggered' | 'On Grace';
  log_retention?: number;
  name?: string;
  owners?: Array<Owner | MetaObject>;
  sql?: string;
  recipients?: Array<Recipient>;
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
};

export enum AlertState {
  success = 'Success',
  working = 'Working',
  error = 'Error',
  noop = 'Not triggered',
  grace = 'On Grace',
}

export enum RecipientIconName {
  email = 'Email',
  slack = 'Slack',
}
