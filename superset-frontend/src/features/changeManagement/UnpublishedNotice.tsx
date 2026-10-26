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
import { Button } from '@superset-ui/core/components';

export interface UnpublishedNoticeProps {
  busy?: boolean;
  onRequestPublish: () => void;
}

/**
 * A draft dashboard is outside the gate until it is published (SOW 5.1).
 *
 * Said out loud because the absence of a review banner is ambiguous: an
 * editor who has been told every change needs approval, and then sees
 * their saves land immediately, reasonably concludes the control is
 * broken. This is the one place the workflow explains why it is standing
 * aside, and it names the moment it stops -- publishing.
 */
export default function UnpublishedNotice({
  busy = false,
  onRequestPublish,
}: UnpublishedNoticeProps) {
  return (
    <Alert
      type="info"
      showIcon
      closable={false}
      data-test="unpublished-notice"
      message={t(
        "This dashboard isn't published yet, so your changes apply directly. Publishing it needs a review.",
      )}
      action={
        <Button
          buttonStyle="primary"
          buttonSize="small"
          disabled={busy}
          onClick={onRequestPublish}
          data-test="request-to-publish"
        >
          {t('Request to publish')}
        </Button>
      }
    />
  );
}
