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
import { useTheme } from '@apache-superset/core/theme';
import { ConfirmModal, Icons } from '@superset-ui/core/components';
import type { QueryWarningConfirmation } from './useQueryCostWarning';

/** Display the server's plain-text assessment without interpreting its units. */
export default function QueryCostWarningDialog({
  estimate,
  onCancel,
  onContinue,
}: {
  estimate?: QueryWarningConfirmation;
  onCancel: () => void;
  onContinue: () => void;
}) {
  const theme = useTheme();
  return (
    <ConfirmModal
      show={!!estimate}
      title={t('Query warning')}
      icon={
        <Icons.WarningOutlined
          iconColor={theme.colorWarning}
          aria-hidden="true"
        />
      }
      onHide={onCancel}
      onConfirm={onContinue}
      cancelText={t('Cancel')}
      confirmText={t('Run anyway')}
      body={
        estimate && (
          <>
            <p>{estimate.message}</p>
            {estimate.details?.map((detail, index) => (
              <p key={index}>
                {detail.label}: <strong>{detail.value}</strong>
              </p>
            ))}
          </>
        )
      }
    />
  );
}
