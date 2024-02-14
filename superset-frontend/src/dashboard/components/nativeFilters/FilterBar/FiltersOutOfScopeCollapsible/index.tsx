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
import React, { ReactNode } from 'react';
import { css } from '@emotion/react';
import { Divider, Filter, SupersetTheme, t } from '@superset-ui/core';
import { AntdCollapse } from 'src/components';

export interface FiltersOutOfScopeCollapsibleProps {
  filtersOutOfScope: (Filter | Divider)[];
  renderer: (filter: Filter | Divider, index: number) => ReactNode;
  hasTopMargin?: boolean;
  horizontalOverflow?: boolean;
  forceRender?: boolean;
}

export const FiltersOutOfScopeCollapsible = ({
  filtersOutOfScope,
  renderer,
  hasTopMargin,
  horizontalOverflow,
  forceRender = false,
}: FiltersOutOfScopeCollapsibleProps) => (
  <AntdCollapse
    ghost
    bordered
    expandIconPosition="right"
    collapsible={filtersOutOfScope.length === 0 ? 'disabled' : undefined}
    css={(theme: SupersetTheme) =>
      horizontalOverflow
        ? css`
            &.ant-collapse > .ant-collapse-item {
              & > .ant-collapse-header {
                padding: 0;

                & > .ant-collapse-arrow {
                  right: 0;
                  padding: 0;
                }
              }

              & .ant-collapse-content-box {
                padding: ${theme.gridUnit * 4}px 0 0;
                margin-bottom: ${theme.gridUnit * -4}px;
              }
            }
          `
        : css`
            &.ant-collapse {
              margin-top: ${hasTopMargin ? theme.gridUnit * 6 : 0}px;
              & > .ant-collapse-item {
                & > .ant-collapse-header {
                  padding-left: 0;
                  padding-bottom: ${theme.gridUnit * 2}px;

                  & > .ant-collapse-arrow {
                    right: ${theme.gridUnit}px;
                  }
                }

                & .ant-collapse-content-box {
                  padding: ${theme.gridUnit * 4}px 0 0;
                }
              }
            }
          `
    }
  >
    <AntdCollapse.Panel
      forceRender={forceRender}
      header={
        <span
          css={(theme: SupersetTheme) => css`
            font-size: ${theme.typography.sizes.s}px;
          `}
        >
          {t('Filters out of scope (%d)', filtersOutOfScope.length)}
        </span>
      }
      key="1"
    >
      {filtersOutOfScope.map(renderer)}
    </AntdCollapse.Panel>
  </AntdCollapse>
);
