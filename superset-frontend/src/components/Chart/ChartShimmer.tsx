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

import { CSSProperties } from 'react';
import { keyframes, styled, useTheme } from '@superset-ui/core';

export interface ChartShimmerProps {
  height?: number;
  width?: number;
  className?: string;
  style?: CSSProperties;
}

const shimmer = keyframes`
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
`;

const Container = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
`;

const BodyBlock = styled.div`
  border-radius: ${({ theme }) => theme.borderRadius}px;
  width: 100%;
  background: ${({ theme }) =>
    `linear-gradient(90deg, ${theme.colors.grayscale.light3}, ${theme.colors.grayscale.light2}, ${theme.colors.grayscale.light3})`};
  background-size: 200% 200%;
  animation: ${shimmer} 1.5s ease-in-out infinite;
  border-radius: 6px;
`;

export default function ChartShimmer({
  height,
  width,
  className,
  style,
}: ChartShimmerProps) {
  const theme = useTheme();
  const effectiveHeight =
    typeof height === 'number' && height > 0 ? height : 220;
  const reservedHeader = 16 + theme.gridUnit * 2; // header height + margin
  const bodyHeight = Math.max(50, effectiveHeight - reservedHeader);

  return (
    <Container
      className={className}
      style={{ ...style, minHeight: effectiveHeight, width: width || '100%' }}
      data-test="chart-shimmer"
    >
      <BodyBlock style={{ height: bodyHeight }} />
    </Container>
  );
}
