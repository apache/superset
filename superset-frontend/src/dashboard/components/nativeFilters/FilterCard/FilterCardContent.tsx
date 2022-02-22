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

import React, { useMemo } from 'react';
import {
  css,
  Filter,
  getChartMetadataRegistry,
  SupersetTheme,
  t,
} from '@superset-ui/core';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';
import Icons from 'src/components/Icons';
import { useFilterDependencies } from './useFilterDependencies';
import { Row, RowLabel, RowValue } from './Styles';
import { ScopeRow } from './ScopeRow';

export const FilterCardContent = ({ filter }: { filter: Filter }) => {
  const metadata = useMemo(
    () => getChartMetadataRegistry().get(filter.filterType),
    [filter.filterType],
  );
  const dependencies = useFilterDependencies(filter);
  return (
    <div>
      <Row
        css={(theme: SupersetTheme) =>
          css`
            margin-bottom: ${theme.gridUnit * 3}px;
          `
        }
      >
        <Icons.FilterSmall
          css={(theme: SupersetTheme) =>
            css`
              margin-right: ${theme.gridUnit}px;
            `
          }
        />
        <span>{filter.name}</span>
      </Row>
      <Row>
        <RowLabel>{t('Filter type')}</RowLabel>
        <RowValue>{metadata?.name}</RowValue>
      </Row>
      <ScopeRow filter={filter} />
      {dependencies.length > 0 && (
        <Row>
          <RowLabel>
            Dependent on{' '}
            <span>
              <InfoTooltipWithTrigger
                tooltip={t(
                  'Filter only displays values relevant to selections made in other filters.',
                )}
                label={t('dependent on')}
              />
            </span>
          </RowLabel>
          <RowValue>
            {dependencies.map(dependency => dependency.name).join(', ')}
          </RowValue>
        </Row>
      )}
    </div>
  );
};
