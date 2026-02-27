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
import { FC, useEffect, useState } from 'react';
import { t, css, useTheme, SupersetClient } from '@superset-ui/core';

interface LastQueriedLabelProps {
  queriedDttm?: string | null;
  datasetId?: number;
}

const LastQueriedLabel: FC<LastQueriedLabelProps> = ({
  datasetId,
  queriedDttm,
}) => {
  const theme = useTheme();
  const [dataAsOf, setDataAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!datasetId) return undefined;

    let cancelled = false;
    setLoading(true);

    SupersetClient.get({
      endpoint: `/api/v1/dataset/${datasetId}/data_as_of`,
    })
      .then(({ json }) => {
        if (!cancelled) {
          setDataAsOf(json?.result?.data_as_of ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDataAsOf(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [datasetId, queriedDttm]);

  if (loading || !dataAsOf) {
    return null;
  }

  return (
    <div
      css={css`
        font-size: ${theme.typography.sizes.s}px;
        color: ${theme.colors.text.label};
        padding: ${theme.gridUnit / 2}px ${theme.gridUnit}px;
        text-align: right;
      `}
      data-test="data-as-of-label"
    >
      {t('Data as of')}: {dataAsOf}
    </div>
  );
};

export default LastQueriedLabel;
