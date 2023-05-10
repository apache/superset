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
export const ERROR_MESSAGES = {
  EMAIL_PATTERN_ERROR:
    'Emails must contain careem domains e.g: abc@careem.com OR abc@ext.careem.com',
  ROUTING_KEY_PATTERN_ERROR:
    'Routing Key must not contain any special charaters other than undescores(_) or hyphens(-)',
  ROUTING_KEY_LIMITATION: 'Only one routing key is allowed',
  GENERIC_INVALID_INPUT:
    'INVALID INPUT LOGGED, Please refer to the respective help text for more information',
  VO_ROUTING_KEY_ERROR:
    'INVALID ROUTING KEY, The entered routing key for VictorOps doesnot exists',
  SAME_METHOD:
    'The selected method is already chosen as a notification method. Please select another or append the recipients in the selected one',
};

export const CRON_SCHEDULE = {
  EVERY_MIN: '*',
  EVERY_HOUR: '0',
};
