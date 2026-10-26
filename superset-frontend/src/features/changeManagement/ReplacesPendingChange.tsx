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
import { styled } from '@apache-superset/core/theme';
import { Alert } from '@apache-superset/core/components';
import type { ChangeStatus } from './types';

/**
 * Said in a delete dialog when the asset already has a change waiting.
 *
 * Only one change can be open per asset, so a delete does not sit beside a
 * pending edit -- it takes its place. That used to happen silently: the
 * author lost the edit they were waiting on, and the only sign was the
 * delete request carrying the edit's note (129078). The delete is still
 * allowed; it just stops being a surprise.
 */
const Spaced = styled.div`
  ${({ theme }) => `margin-top: ${theme.sizeUnit * 3}px;`}
`;

export interface ReplacesPendingChangeProps {
  /** The open change's status, or undefined when there is none. */
  status?: ChangeStatus | null;
}

export default function ReplacesPendingChange({
  status,
}: ReplacesPendingChangeProps) {
  if (!status) {
    return null;
  }
  return (
    <Spaced>
      <Alert
        type="warning"
        showIcon
        message={t('This replaces the change waiting for review')}
        description={t(
          'Only one change can be open at a time, so deleting this ' +
            'discards the edit that is waiting and asks a reviewer to ' +
            'approve the delete instead.',
        )}
        data-test="replaces-pending-change"
      />
    </Spaced>
  );
}
