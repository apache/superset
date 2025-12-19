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
import { useSelector } from 'react-redux';
import { css, keyframes } from '@emotion/react';
import { RootState, WhatIfModification } from 'src/dashboard/types';
import {
  extractColumnsFromSlice,
  collectSqlExpressionsFromSlice,
  findColumnsInSqlExpressions,
} from './whatIf';

const EMPTY_STYLES = undefined;

/* eslint-disable theme-colors/no-literal-colors */
const rainbowSlide = keyframes`
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 300% 50%;
  }
`;

const pulse = keyframes`
  0%, 100% {
    opacity: 0.6;
    filter: blur(2px);
  }
  50% {
    opacity: 0.9;
    filter: blur(6px);
  }
`;

export const whatIfHighlightStyles = css`
  position: relative;

  &::before {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: 10px;
    padding: 3px;
    background: linear-gradient(
      90deg,
      #ff8a8a,
      #ffbe8a,
      #ffff8a,
      #beff8a,
      #8aff8a,
      #8affbe,
      #8affff,
      #8abeff,
      #8a8aff,
      #be8aff,
      #ff8aff,
      #ff8abe,
      #ff8a8a,
      #ffbe8a,
      #ffff8a,
      #beff8a,
      #8aff8a,
      #8affbe,
      #8affff,
      #8abeff,
      #8a8aff,
      #be8aff,
      #ff8aff,
      #ff8abe,
      #ff8a8a
    );
    background-size: 300% 100%;
    animation:
      ${rainbowSlide} 20s linear infinite,
      ${pulse} 3s ease-in-out infinite;
    -webkit-mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }
`;
/* eslint-enable theme-colors/no-literal-colors */

/**
 * Hook that returns animated rainbow border styles for charts
 * that are affected by what-if transformations.
 */
const useWhatIfHighlightStyles = (chartId: number) => {
  const whatIfModifications = useSelector(
    (state: RootState) => state.dashboardState.whatIfModifications,
  );

  const slice = useSelector(
    (state: RootState) => state.sliceEntities?.slices?.[chartId],
  );

  const isAffected = useMemo(() => {
    if (!whatIfModifications || whatIfModifications.length === 0) {
      return false;
    }

    if (!slice) {
      return false;
    }

    const chartColumns = extractColumnsFromSlice(slice);
    const modifiedColumnNames = whatIfModifications.map(
      (mod: WhatIfModification) => mod.column,
    );
    const modifiedColumns = new Set(modifiedColumnNames);

    // Check if any of the chart's explicitly referenced columns are being modified
    for (const column of chartColumns) {
      if (modifiedColumns.has(column)) {
        return true;
      }
    }

    // Also check if modified columns appear in SQL expressions
    const sqlExpressions = collectSqlExpressionsFromSlice(slice);
    if (sqlExpressions.length > 0) {
      const sqlReferencedColumns = findColumnsInSqlExpressions(
        sqlExpressions,
        modifiedColumnNames,
      );
      if (sqlReferencedColumns.size > 0) {
        return true;
      }
    }

    return false;
  }, [whatIfModifications, slice]);

  if (!isAffected) {
    return EMPTY_STYLES;
  }

  return whatIfHighlightStyles;
};

export default useWhatIfHighlightStyles;
