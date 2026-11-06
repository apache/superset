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
import { NotificationMethodOption, NotificationSetting } from './types';

const isSlackMethod = (method: NotificationMethodOption | undefined) =>
  method === NotificationMethodOption.Slack ||
  method === NotificationMethodOption.SlackV2;

export function getNotificationMethodOptions(
  available: NotificationMethodOption[],
  settings: NotificationSetting[],
  currentIndex?: number,
): NotificationMethodOption[] {
  const selected =
    currentIndex === undefined ? undefined : settings[currentIndex]?.method;
  const options = available.filter(
    method =>
      method === NotificationMethodOption.Teams ||
      !settings.some(
        (setting, index) =>
          index !== currentIndex &&
          (setting.method === method ||
            (isSlackMethod(setting.method) && isSlackMethod(method))),
      ),
  );
  return selected ? Array.from(new Set([...options, selected])) : options;
}

export function supportsTeamsRecipients(
  isReport: boolean,
  attachmentsEnabled: boolean,
  reportFormat: string,
): boolean {
  return !isReport && (!attachmentsEnabled || reportFormat === 'NONE');
}
