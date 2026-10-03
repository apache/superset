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
import { t } from '@apache-superset/core/translation';
import { dashboardComponents } from 'src/core';
import IframeContent from './IframeContent';

export const IFRAME_COMPONENT_ID = 'superset.iframe';

/**
 * Registers the built-in iframe as a first-class dashboard component through the
 * Extensions `dashboardComponents` contribution point. Core registers it the
 * same way a third-party extension would, demonstrating the contract end to end.
 */
export default function registerIframeComponent() {
  dashboardComponents.registerDashboardComponent(
    {
      id: IFRAME_COMPONENT_ID,
      name: t('Embed / Iframe'),
      description: t('Embed external content via a URL'),
      icon: 'LinkOutlined',
      resizable: true,
      defaultMeta: { width: 4, height: 50, url: '' },
    },
    IframeContent,
  );
}
