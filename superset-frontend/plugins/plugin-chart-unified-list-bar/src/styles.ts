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
import styled from '@emotion/styled';

// Fallback theme values in case the provided theme is missing properties
const fallbackTheme = {
  typography: {
    families: {
      sansSerif: '"Inter", Helvetica, Arial, sans-serif',
    },
    weights: {
      bold: 700,
      normal: 400,
    },
  },
  gridUnit: 4,
  colors: {
    grayscale: {
      light2: '#E0E0E0',
      light5: '#F5F5F5',
      base: '#484848',
      dark1: '#262626',
    },
  },
};

const getTheme = (theme: any) => theme || fallbackTheme;

export const Styles = styled.div<{ height: number; width: number }>`
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
  overflow-y: auto;
  overflow-x: hidden;
  font-family: ${({ theme }) => getTheme(theme)?.typography?.families?.sansSerif || fallbackTheme.typography.families.sansSerif};
`;

export const RowContainer = styled.div<{ rowsPerItem: '1' | '2' }>`
  display: flex;
  flex-direction: row;
  align-items: stretch;
  padding: ${({ theme }) => (getTheme(theme)?.gridUnit || fallbackTheme.gridUnit) * 2}px;
  border-bottom: 1px solid ${({ theme }) => getTheme(theme)?.colors?.grayscale?.light2 || fallbackTheme.colors.grayscale.light2};
  &:hover {
    background-color: ${({ theme }) => getTheme(theme)?.colors?.grayscale?.light5 || fallbackTheme.colors.grayscale.light5};
  }
`;

// Left section: Key Column + Sub Text
export const KeySection = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 100px;
  padding-right: ${({ theme }) => (getTheme(theme)?.gridUnit || fallbackTheme.gridUnit) * 3}px;
`;

export const KeyField = styled.div<{ fontSize: number; color: string }>`
  font-size: ${({ fontSize }) => fontSize}px;
  color: ${({ color }) => color};
  font-weight: ${({ theme }) => getTheme(theme)?.typography?.weights?.bold || fallbackTheme.typography.weights.bold};
`;

export const KeySubField = styled.div<{ fontSize: number }>`
  font-size: ${({ fontSize }) => fontSize}px;
  color: ${({ theme }) => getTheme(theme)?.colors?.grayscale?.base || fallbackTheme.colors.grayscale.base};
  margin-top: ${({ theme }) => (getTheme(theme)?.gridUnit || fallbackTheme.gridUnit)}px;
`;

// Right section: Secondary Columns + Bar
export const ContentSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

export const SecondaryFieldsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => (getTheme(theme)?.gridUnit || fallbackTheme.gridUnit)}px;
`;

export const SecondaryField = styled.div<{ fontSize: number }>`
  font-size: ${({ fontSize }) => fontSize}px;
  color: ${({ theme }) => getTheme(theme)?.colors?.grayscale?.base || fallbackTheme.colors.grayscale.base};
`;

// Bar section: below secondary columns
export const BarSection = styled.div`
  margin-top: ${({ theme }) => (getTheme(theme)?.gridUnit || fallbackTheme.gridUnit) * 2}px;
`;

export const BarContainer = styled.div`
  width: 100%;
  height: 8px;
  background-color: ${({ theme }) => getTheme(theme)?.colors?.grayscale?.light2 || fallbackTheme.colors.grayscale.light2};
  border-radius: 4px;
  overflow: hidden;
`;

export const BarFill = styled.div<{ width: number; color: string }>`
  width: ${({ width }) => width}%;
  height: 100%;
  background-color: ${({ color }) => color};
  transition: width 0.3s ease;
`;

export const MetricValue = styled.span`
  font-size: 18px;
  font-weight: ${({ theme }) => getTheme(theme)?.typography?.weights?.bold || fallbackTheme.typography.weights.bold};
  color: ${({ theme }) => getTheme(theme)?.colors?.grayscale?.dark1 || fallbackTheme.colors.grayscale.dark1};
`;

export const IconContainer = styled.span`
  display: inline-flex;
  align-items: center;
`;

// Legacy exports (kept for backwards compatibility, but no longer used)
export const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

export const MetricContainer = styled.div<{ align: 'left' | 'right' }>`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: ${({ align }) => (align === 'right' ? 'flex-end' : 'flex-start')};
`;
