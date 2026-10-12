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
import { useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { getClientErrorObject, SupersetClient } from '@superset-ui/core';
import { Button } from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';

/**
 * What entering a draft is called in the UI. A working name, still being
 * settled; changing it here changes it everywhere it is shown.
 */
export const PLAN_MODE_LABEL = () => t('Plan mode');

interface PlanModeButtonProps {
  canvasId: number;
  /** Called with the new draft's token, to open it on this page. */
  onStarted: (token: string) => void;
}

/**
 * Starts a plan: a private draft of the canvas, which is where changes are
 * made. The published canvas itself is read-only, so this is how a user with
 * edit permission gets somewhere they can drag, resize and ask for changes.
 * The draft is published or discarded from the banner it shows.
 */
export default function PlanModeButton({
  canvasId,
  onStarted,
}: PlanModeButtonProps) {
  const { addDangerToast } = useToasts();
  const [starting, setStarting] = useState(false);

  const start = async () => {
    setStarting(true);
    try {
      const { json } = await SupersetClient.post({
        endpoint: `/api/v1/canvas/${canvasId}/draft`,
      });
      const token = json?.result?.token;
      if (typeof token === 'string') {
        onStarted(token);
      } else {
        addDangerToast(t('That plan could not be started.'));
      }
    } catch (response) {
      const { message, error } = await getClientErrorObject(response);
      addDangerToast(message || error || t('That plan could not be started.'));
    } finally {
      setStarting(false);
    }
  };

  return (
    <Button
      buttonStyle="secondary"
      loading={starting}
      onClick={start}
      data-test="canvas-plan-mode"
    >
      {PLAN_MODE_LABEL()}
    </Button>
  );
}
