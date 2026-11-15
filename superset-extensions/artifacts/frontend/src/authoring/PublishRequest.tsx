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
 * @fileoverview Where the user confirms an agent's request to publish
 * (DR-12): a notice by the artifact, for its owners, that publishes under
 * their own session. Agents can only ask.
 */

// TODO(T5): a confirmation screen that shows the diff from the published
// version, rather than a notice by the artifact.

import { useState } from 'react';
import { components, translation } from '@apache-superset/core';
import { API_BASE_PATH } from '../constants';
import type { PendingPublish } from '../frames/api';
import { errorMessage, requestJson } from '../http';

const { Alert } = components;
const { t } = translation;

export async function confirmPublish(
  artifactId: string,
  requestId: string,
): Promise<string> {
  const { result } = await requestJson<{
    result: { published_version: string };
  }>(`${API_BASE_PATH}/publish/${encodeURIComponent(artifactId)}/confirm`, {
    method: 'POST',
    body: { request_id: requestId },
  });
  return result.published_version;
}

export default function PublishRequest({
  artifactId,
  pending,
  onPublished,
}: {
  artifactId: string;
  pending: PendingPublish;
  onPublished: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const publish = () => {
    setBusy(true);
    setError(undefined);
    confirmPublish(artifactId, pending.request_id)
      .then(onPublished)
      .catch((reason: unknown) => setError(errorMessage(reason)))
      .finally(() => setBusy(false));
  };

  return (
    <Alert
      type={error ? 'error' : 'info'}
      closable={false}
      description={error}
      action={
        <button type="button" disabled={busy} onClick={publish}>
          {t('Publish')}
        </button>
      }
    >
      {t(
        'An agent asked to publish version %s of this artifact. Publishing shows it to everyone who can see it here.',
        pending.version.slice(0, 12),
      )}
    </Alert>
  );
}
