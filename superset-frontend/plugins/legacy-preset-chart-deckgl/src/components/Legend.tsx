/* eslint-disable react/jsx-sort-default-props */
/* eslint-disable react/sort-prop-types */
/* eslint-disable jsx-a11y/anchor-is-valid */
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
import React, { memo } from 'react';
import { formatNumber, styled } from '@superset-ui/core';

const StyledLegend = styled.div`
  ${({ theme }) => `
    font-size: ${theme.typography.sizes.s}px;
    position: absolute;
    background: ${theme.colors.grayscale.light5};
    box-shadow: 0 0 ${theme.gridUnit}px ${theme.colors.grayscale.light2};
    margin: ${theme.gridUnit * 6}px;
    padding: ${theme.gridUnit * 3}px ${theme.gridUnit * 5}px;
    outline: none;
    overflow-y: scroll;
    max-height: 200px;

    & ul {
      list-style: none;
      padding-left: 0;
      margin: 0;

      & li a {
        color: ${theme.colors.grayscale.base};
        text-decoration: none;

        & span {
          margin-right: ${theme.gridUnit * 3}px;
        }
      }
    }
  `}
`;

const categoryDelimiter = ' - ';

export type LegendProps = {
  format: string | null;
  forceCategorical?: boolean;
  position?: null | 'tl' | 'tr' | 'bl' | 'br';
  categories: Record<string, { enabled: boolean; color: number[] }>;
  toggleCategory?: (key: string) => void;
  showSingleCategory?: (key: string) => void;
};

const Legend = ({
  format: d3Format = null,
  forceCategorical = false,
  position = 'tr',
  categories: categoriesObject = {},
  toggleCategory = () => {},
  showSingleCategory = () => {},
}: LegendProps) => {
  const format = (value: string) => {
    if (!d3Format || forceCategorical) {
      return value;
    }

    const numValue = parseFloat(value);

    return formatNumber(d3Format, numValue);
  };

  const formatCategoryLabel = (k: string) => {
    if (!d3Format) {
      return k;
    }

    if (k.includes(categoryDelimiter)) {
      const values = k.split(categoryDelimiter);

      return format(values[0]) + categoryDelimiter + format(values[1]);
    }

    return format(k);
  };

  if (Object.keys(categoriesObject).length === 0 || position === null) {
    return null;
  }

  const categories = Object.entries(categoriesObject).map(([k, v]) => {
    const style = { color: `rgba(${v.color.join(', ')})` };
    const icon = v.enabled ? '\u25FC' : '\u25FB';

    return (
      <li key={k}>
        <a
          href="#"
          onClick={() => toggleCategory(k)}
          onDoubleClick={() => showSingleCategory(k)}
        >
          <span style={style}>{icon}</span> {formatCategoryLabel(k)}
        </a>
      </li>
    );
  });

  const vertical = position?.charAt(0) === 't' ? 'top' : 'bottom';
  const horizontal = position?.charAt(1) === 'r' ? 'right' : 'left';
  const style = {
    position: 'absolute' as const,
    [vertical]: '0px',
    [horizontal]: '10px',
  };

  return (
    <StyledLegend className="dupa" style={style}>
      <ul>{categories}</ul>
    </StyledLegend>
  );
};

export default memo(Legend);
