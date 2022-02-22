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
import React, { ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { Filter, t } from '@superset-ui/core';
import { Tooltip } from 'src/components/Tooltip';
import { useFilterScope } from './useFilterScope';
import { Row, RowLabel, RowTruncationCount, RowValue } from './Styles';

export const isLabelTruncated = (labelRef?: React.RefObject<any>) =>
  !!(
    labelRef &&
    labelRef.current &&
    labelRef.current.scrollWidth > labelRef.current.clientWidth
  );

export const ScopeRow = ({ filter }: { filter: Filter }) => {
  const scope = useFilterScope(filter);
  const scopeRef = useRef(null);
  const [elementsTruncated] = useState(5);
  const [tooltipText, setTooltipText] = useState<ReactNode | string | null>(
    null,
  );

  useLayoutEffect(() => {
    if (isLabelTruncated(scopeRef)) {
      setTooltipText(scope?.map(val => <div>{val}</div>));
    }
  }, [scope]);

  console.log({ tooltipText });
  return Array.isArray(scope) && scope.length > 0 ? (
    <Row>
      <RowLabel>{t('Scope')}</RowLabel>

      <RowValue ref={scopeRef}>
        <Tooltip title={tooltipText}>{scope.join(', ')}</Tooltip>
      </RowValue>
      {elementsTruncated && (
        <RowTruncationCount>+{elementsTruncated}</RowTruncationCount>
      )}
    </Row>
  ) : null;
};
