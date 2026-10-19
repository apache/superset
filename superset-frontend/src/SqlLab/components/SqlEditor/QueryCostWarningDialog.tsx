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
import { Button, Modal } from '@superset-ui/core/components';
import { queryCostWarningMetrics } from 'src/features/databases/queryCostWarning';
import type { WarningEstimate } from './useQueryCostWarning';

/** Confirm a server-side comparison without rounding or converting native units. */
export default function QueryCostWarningDialog({
  estimate,
  onCancel,
  onContinue,
}: {
  estimate?: WarningEstimate;
  onCancel: () => void;
  onContinue: () => void;
}) {
  const format = (value: number | bigint) =>
    typeof value === 'bigint'
      ? value.toLocaleString()
      : value.toLocaleString(undefined, { maximumSignificantDigits: 21 });
  return (
    <Modal
      show={!!estimate}
      title={t('Query cost warning')}
      onHide={onCancel}
      footer={
        <>
          <Button buttonStyle="secondary" onClick={onCancel}>
            {t('Cancel')}
          </Button>
          <Button buttonStyle="primary" onClick={onContinue}>
            {estimate?.status === 'unavailable'
              ? t('Run without estimate')
              : t('Run anyway')}
          </Button>
        </>
      }
    >
      {estimate && (
        <>
          <p>{estimate.message}</p>
          {estimate.value !== null && (
            <p>
              {estimate.label}:{' '}
              <strong>
                {format(estimate.value)} {estimate.unit}
              </strong>
              {estimate.accuracy === 'LOWER_BOUND' && (
                <> ({t('lower bound')})</>
              )}
              {estimate.accuracy === 'UPPER_BOUND' && (
                <> ({t('upper bound')})</>
              )}
            </p>
          )}
          <p>
            {t('Warning threshold')}:{' '}
            <strong>
              {format(estimate.threshold)} {estimate.unit}
            </strong>
          </p>
          <p>{queryCostWarningMetrics[estimate.metric].explanation()}</p>
        </>
      )}
    </Modal>
  );
}
