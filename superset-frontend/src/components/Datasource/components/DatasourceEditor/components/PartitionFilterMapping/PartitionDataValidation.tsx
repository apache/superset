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

import { useEffect, useRef, useState } from 'react';
import { SupersetClient, getClientErrorObject } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { Alert } from '@apache-superset/core/components';
import { Button, Flex, Input, Typography } from '@superset-ui/core/components';
import type {
  PartitionDataValidationResult,
  PartitionMappingPreview,
} from './types';

interface Props {
  datasetId?: number;
  mappedColumn: string;
  partitionColumn: string;
  valueTransform: string;
  isMonotonic: boolean;
  sampleValues: string[];
  operator: string;
  disabled: boolean;
}

/** Explicitly check actual row pairs; never scan a table while typing a transform. */
export default function PartitionDataValidation(props: Props) {
  const [keys, setKeys] = useState('');
  const [result, setResult] = useState<PartitionDataValidationResult>();
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  const identity = JSON.stringify([props, keys]);
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const [resultIdentity, setResultIdentity] = useState('');
  useEffect(() => {
    requestId.current += 1;
    setLoading(false);
    setResult(undefined);
    return () => {
      requestId.current += 1;
    };
  }, [identity]);
  const values = keys.split(',').map(key => key.trim());
  const keysValid =
    values.length <= 3 && values.every(key => /^-?[0-9]{1,20}$/.test(key));

  const validate = async () => {
    requestId.current += 1;
    const currentRequest = requestId.current;
    const submittedIdentity = identity;
    setLoading(true);
    setResult(undefined);
    const current = () =>
      currentRequest === requestId.current &&
      submittedIdentity === identityRef.current;
    try {
      const { json } = await SupersetClient.post({
        endpoint: `/api/v1/dataset/${props.datasetId}/partition_mapping/preview/`,
        jsonPayload: {
          mapped_column: props.mappedColumn,
          partition_column: props.partitionColumn,
          value_transform: props.valueTransform,
          is_monotonic: props.isMonotonic,
          sample_values: props.sampleValues,
          operator: props.operator,
          validation_partition_values: values,
        },
      });
      if (current()) {
        setResult((json.result as PartitionMappingPreview).data_validation);
        setResultIdentity(submittedIdentity);
      }
    } catch (error) {
      const clientError = await getClientErrorObject(error);
      if (current()) {
        setResult({
          status: 'inconclusive',
          message: clientError.error || t('Data validation failed.'),
        });
        setResultIdentity(submittedIdentity);
      }
    } finally {
      if (current()) setLoading(false);
    }
  };
  const visible = resultIdentity === identity ? result : undefined;
  return (
    <Flex vertical gap="small">
      <Typography.Text>
        {t('Existing partition keys (up to three, comma separated)')}
      </Typography.Text>
      <Input
        aria-label={t('Existing partition keys')}
        value={keys}
        onChange={event => setKeys(event.target.value)}
        placeholder={t('Enter stored epoch partition keys, not timestamps')}
      />
      <Typography.Text type="secondary">
        {t(
          'Checks up to 50 rows per selected partition. Sampling cannot verify every row or future ingestion.',
        )}
      </Typography.Text>
      <Button
        onClick={validate}
        loading={loading}
        disabled={props.disabled || !props.datasetId || !keysValid}
      >
        {t('Validate against data')}
      </Button>
      {visible && (
        <Alert
          type={visible.status === 'matched' ? 'success' : 'warning'}
          showIcon
          message={
            visible.status === 'matched'
              ? t(
                  'Matched %(rows)s sampled rows across %(partitions)s partitions',
                  {
                    rows: visible.checked_rows ?? 0,
                    partitions: visible.partitions_checked ?? 0,
                  },
                )
              : visible.status === 'mismatch'
                ? t('Partition mismatch found')
                : t('Validation inconclusive')
          }
          description={
            <Flex vertical>
              <Typography.Text>{visible.message}</Typography.Text>
              {visible.examples?.map((example, index) => (
                <Typography.Text key={index} code>
                  {t(
                    'Source: %(source)s; stored key: %(stored)s; transform: %(actual)s',
                    {
                      source: example.source_value,
                      stored: example.stored_key,
                      actual: example.transformed_value ?? 'NULL',
                    },
                  )}
                </Typography.Text>
              ))}
            </Flex>
          }
        />
      )}
    </Flex>
  );
}
