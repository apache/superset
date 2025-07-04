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
import { ReactNode } from 'react';
import { css, Divider, Filter, SupersetTheme, t } from '@superset-ui/core';
import { Collapse } from '@superset-ui/core/components';

export interface FiltersOutOfScopeCollapsibleProps {
  filtersOutOfScope: (Filter | Divider)[];
  renderer: (filter: Filter | Divider, index: number) => ReactNode;
  forceRender?: boolean;
}

export const FiltersOutOfScopeCollapsible = ({
  filtersOutOfScope,
  renderer,
  forceRender = false,
}: FiltersOutOfScopeCollapsibleProps) => (
  <Collapse
    ghost
    bordered
    expandIconPosition="end"
    collapsible={filtersOutOfScope.length === 0 ? 'disabled' : undefined}
    items={[
      {
        key: 'out-of-scope-filters',
        label: (
          <span
            css={(theme: SupersetTheme) => css`
              font-size: ${theme.fontSizeSM}px;
            `}
          >
            {t('Filters out of scope (%d)', filtersOutOfScope.length)}
          </span>
        ),
        children: filtersOutOfScope.map(renderer),
        forceRender,
      },
    ]}
  />
);
