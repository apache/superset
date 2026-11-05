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
import { Icons } from '@superset-ui/core/components/Icons';

type AlertType = 'success' | 'info' | 'warning' | 'error';

const ALERT_ICONS = {
  success: Icons.CheckCircleFilled,
  info: Icons.InfoCircleFilled,
  warning: Icons.ExclamationCircleFilled,
  error: Icons.CloseCircleFilled,
};

/**
 * The icon antd shows by default for an Alert of this type, hidden from
 * assistive technology. `style={undefined}` drops the Superset icon's inline
 * font size, so antd sizes it as its own (24px next to a description).
 */
export function limitAlertIcon(type: AlertType) {
  const Icon = ALERT_ICONS[type];
  return <Icon aria-hidden style={undefined} />;
}
