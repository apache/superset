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
import { Alert } from '@apache-superset/core/components';

/**
 * Says that a canvas is being edited privately.
 *
 * Only says it: publishing and discarding live in the toolbar, beside the
 * switch that got you here. Who can see the changes is the part that is not
 * obvious from looking at the screen, so it is the part that is written down.
 */
export default function DraftBanner() {
  return (
    <Alert
      type="info"
      showIcon
      message={t('Draft')}
      description={t('Only you can see these changes until you publish them.')}
      data-test="canvas-draft-banner"
    />
  );
}
