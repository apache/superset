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
import React, { useRef, useState, useEffect } from 'react';
import { t } from '@superset-ui/core';
import { useTruncation } from 'src/hooks/useTruncation';
import { useFilterScope } from './useFilterScope';
import {
  Row,
  RowLabel,
  RowTruncationCount,
  RowValue,
  TooltipList,
  TooltipSectionLabel,
} from './Styles';
import { FilterCardRowProps } from './types';
import { TooltipWithTruncation } from './TooltipWithTruncation';

const getTooltipSection = (items: string[] | undefined, label: string) =>
  Array.isArray(items) && items.length > 0 ? (
    <>
      <TooltipSectionLabel>{label}:</TooltipSectionLabel>
      <TooltipList>
        {items.map(item => (
          <li>{item}</li>
        ))}
      </TooltipList>
    </>
  ) : null;

export const ScopeRow = ({
  filter,
  isContainerVisible = true,
}: FilterCardRowProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const scope = useFilterScope(filter);
  const scopeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setIsVisible(isContainerVisible);
  }, [isContainerVisible]);

  const [isTruncated, hiddenElementCount] = useTruncation(scopeRef, isVisible);
  const tooltipText = () => {
    if (!isTruncated && !scope) {
      return null;
    }
    if (scope?.all) {
      return <span>{t('All charts')}</span>;
    }
    return (
      <div>
        {getTooltipSection(scope?.tabs, t('Tabs'))}
        {getTooltipSection(scope?.charts, t('Charts'))}
      </div>
    );
  };

  return (
    <Row>
      <RowLabel>{t('Scope')}</RowLabel>
      <TooltipWithTruncation title={tooltipText}>
        <RowValue ref={scopeRef}>
          {scope
            ? Object.values(scope)
                .flat()
                .map((element, index) => (
                  <span key={element}>
                    {index === 0 ? element : `, ${element}`}
                  </span>
                ))
            : t('None')}
        </RowValue>
        {hiddenElementCount > 0 && (
          <RowTruncationCount>+{hiddenElementCount}</RowTruncationCount>
        )}
      </TooltipWithTruncation>
    </Row>
  );
};
