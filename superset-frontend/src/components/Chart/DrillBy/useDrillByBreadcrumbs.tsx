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

import { useMemo } from 'react';
import {
  BinaryQueryObjectFilterClause,
  Column,
  css,
  ensureIsArray,
  styled,
  SupersetTheme,
} from '@superset-ui/core';
import { AntdBreadcrumb } from 'src/components/index';
import { noOp } from 'src/utils/common';

export interface DrillByBreadcrumb {
  groupby: Column | Column[];
  filters?: BinaryQueryObjectFilterClause[];
}

const BreadcrumbItem = styled(AntdBreadcrumb.Item)<{
  isClickable: boolean;
  isHidden: boolean;
}>`
  ${({ theme, isClickable, isHidden }) => css`
    cursor: ${isClickable ? 'pointer' : 'auto'};
    color: ${theme.colors.grayscale.light1};
    transition: color ease-in ${theme.transitionTiming}s;
    .ant-breadcrumb > span:last-child > & {
      color: ${theme.colors.grayscale.dark1};
    }
    &:hover {
      color: ${isClickable ? theme.colors.grayscale.dark1 : 'inherit'};
    }
    visibility: ${isHidden ? 'hidden' : 'visible'};
  `}
`;

export const useDrillByBreadcrumbs = (
  breadcrumbsData: DrillByBreadcrumb[],
  onBreadcrumbClick: (
    breadcrumb: DrillByBreadcrumb,
    index: number,
  ) => void = noOp,
) =>
  useMemo(() => {
    // the last breadcrumb is not clickable
    const isClickable = (index: number) => index < breadcrumbsData.length - 1;
    const isHidden = (breadcumb: DrillByBreadcrumb) =>
      ensureIsArray(breadcumb.groupby).length === 0 &&
      ensureIsArray(breadcumb.filters).length === 0;
    const getBreadcrumbText = (breadcrumb: DrillByBreadcrumb) =>
      `${ensureIsArray(breadcrumb.groupby)
        .map(column => column.verbose_name || column.column_name)
        .join(', ')} ${
        breadcrumb.filters
          ? `(${breadcrumb.filters
              .map(filter => filter.formattedVal || filter.val)
              .join(', ')})`
          : ''
      }`;
    return (
      <AntdBreadcrumb
        css={(theme: SupersetTheme) => css`
          margin: ${theme.gridUnit * 2}px 0 ${theme.gridUnit * 4}px;
        `}
      >
        {breadcrumbsData
          .map((breadcrumb, index) => (
            <BreadcrumbItem
              key={index}
              isClickable={isClickable(index)}
              isHidden={isHidden(breadcrumb)}
              onClick={
                isClickable(index)
                  ? () => onBreadcrumbClick(breadcrumb, index)
                  : noOp
              }
              data-test="drill-by-breadcrumb-item"
            >
              {getBreadcrumbText(breadcrumb)}
            </BreadcrumbItem>
          ))
          .filter(item => item.props.isHidden === false)}
      </AntdBreadcrumb>
    );
  }, [breadcrumbsData, onBreadcrumbClick]);
