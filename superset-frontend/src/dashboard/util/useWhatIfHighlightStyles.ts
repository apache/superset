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
import { extractColumnsFromSlice } from './whatIf';

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
    opacity: 0.7;
    filter: blur(0px);
  }
  50% {
    opacity: 1;
    filter: blur(2px);
  }
`;

const whatIfHighlightStyles = css`
  position: relative;

  &::before {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: 10px;
    padding: 4px;
    background: linear-gradient(
      90deg,
      #ff0000,
      #ff8000,
      #ffff00,
      #80ff00,
      #00ff00,
      #00ff80,
      #00ffff,
      #0080ff,
      #0000ff,
      #8000ff,
      #ff00ff,
      #ff0080,
      #ff0000,
      #ff8000,
      #ffff00,
      #80ff00,
      #00ff00,
      #00ff80,
      #00ffff,
      #0080ff,
      #0000ff,
      #8000ff,
      #ff00ff,
      #ff0080,
      #ff0000
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
    const modifiedColumns = new Set(
      whatIfModifications.map((mod: WhatIfModification) => mod.column),
    );

    // Check if any of the chart's columns are being modified
    for (const column of chartColumns) {
      if (modifiedColumns.has(column)) {
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
