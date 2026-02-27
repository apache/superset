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
import { t } from '@apache-superset/core';
import {
  ChartCustomization,
  ChartCustomizationDivider,
} from '@superset-ui/core';
import { css, SupersetTheme } from '@apache-superset/core/ui';
import { Collapse } from '@superset-ui/core/components';

export interface CustomizationsOutOfScopeCollapsibleProps {
  customizationsOutOfScope: (ChartCustomization | ChartCustomizationDivider)[];
  renderer: (
    customization: ChartCustomization | ChartCustomizationDivider,
    index: number,
  ) => ReactNode;
  forceRender?: boolean;
}

export const CustomizationsOutOfScopeCollapsible = ({
  customizationsOutOfScope,
  renderer,
  forceRender = false,
}: CustomizationsOutOfScopeCollapsibleProps) => (
  <Collapse
    ghost
    bordered
    expandIconPosition="end"
    collapsible={customizationsOutOfScope.length === 0 ? 'disabled' : undefined}
    items={[
      {
        key: 'out-of-scope-customizations',
        label: (
          <span
            css={(theme: SupersetTheme) => css`
              font-size: ${theme.fontSizeSM}px;
            `}
          >
            {t(
              'Customizations out of scope (%d)',
              customizationsOutOfScope.length,
            )}
          </span>
        ),
        children: customizationsOutOfScope.map(renderer),
        forceRender,
      },
    ]}
  />
);
