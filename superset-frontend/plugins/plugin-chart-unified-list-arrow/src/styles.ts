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

// Fallback theme values
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

export const RowContainer = styled.div<{ rowsPerItem?: '1' | '2' }>`
  display: flex;
  flex-direction: row;
  align-items: center; // Vertically center everything
  justify-content: space-between;
  padding: ${({ theme }) => (getTheme(theme)?.gridUnit || fallbackTheme.gridUnit) * 2}px;
  border-bottom: 1px solid ${({ theme }) => getTheme(theme)?.colors?.grayscale?.light2 || fallbackTheme.colors.grayscale.light2};
  &:hover {
    background-color: ${({ theme }) => getTheme(theme)?.colors?.grayscale?.light5 || fallbackTheme.colors.grayscale.light5};
  }
`;

// Left section: Status, Key, Sub Key
export const LeftSection = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 150px; // Ensure some space
  flex: 1;
`;

export const StatusField = styled.div<{ color?: string }>`
  font-size: 11px;
  font-weight: bold;
  color: ${({ color }) => color || '#f39c12'}; // Default orange/gold
  text-transform: uppercase;
  margin-bottom: 2px;
`;

export const KeyField = styled.div<{ fontSize: number; color: string }>`
  font-size: ${({ fontSize }) => fontSize}px;
  color: ${({ color }) => color};
  font-weight: ${({ theme }) => getTheme(theme)?.typography?.weights?.bold || fallbackTheme.typography.weights.bold};
  line-height: 1.2;
`;

export const KeySubField = styled.div<{ fontSize: number }>`
  font-size: ${({ fontSize }) => fontSize}px;
  color: ${({ theme }) => getTheme(theme)?.colors?.grayscale?.base || fallbackTheme.colors.grayscale.base};
  margin-top: 2px;
`;

// Middle section: Arrow
export const MiddleSection = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 16px;
  flex: 0 0 160px; // Fixed width for arrow area? Or flexible?
`;

export const ArrowContainer = styled.div`
  position: relative;
  width: 140px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

// CSS Triangle/Arrow-ish shape or SVG wrapper
// We can use clip-path for a nice arrow
// polygon(0% 20%, 85% 20%, 85% 0%, 100% 50%, 85% 100%, 85% 80%, 0% 80%) -> Arrow with tail
// But user image shows a simple arrow: Tail -> Head.
// Image: "LOADING" inside a yellow arrow.
// The arrow looks like a block with a triangle at the end.
export const ArrowShape = styled.div<{ color: string }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: ${({ color }) => color};
  clip-path: polygon(0% 0%, 85% 0%, 100% 50%, 85% 100%, 0% 100%); // Blocky arrow
  // To make it look more like the image (tail + head), let's try:
  // Layout in image: Rectangle | Triangle
`;

export const ArrowText = styled.div`
  position: relative;
  z-index: 1;
  font-size: 11px;
  font-weight: bold;
  color: #000; // Usually black text on colored arrows? Or white? User image has black text "LOADING".
  text-transform: uppercase;
  text-align: center;
  width: 85%; // Keep text away from the tip
`;

// Right section: Secondary and Tertiary
export const RightSection = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start; // Align text to left
  min-width: 120px;
  flex: 1;
  padding-left: 16px;
`;

export const SecondaryField = styled.div<{ fontSize: number }>`
  font-size: ${({ fontSize }) => fontSize}px;
  font-weight: bold; // Title like "Tank"
  color: #555;
`;

export const TertiaryField = styled.div<{ fontSize: number }>`
  font-size: ${({ fontSize }) => fontSize}px; // Maybe larger? "BK-2" looks big in image
  font-weight: bold;
  color: #000;
  margin-top: 2px;
`;

// End section: The one column at the end
export const EndSection = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-end;
  min-width: 80px;
  text-align: right;
`;

export const EndFieldLabel = styled.div`
  font-size: 12px;
  color: #777;
  margin-bottom: 2px;
`;

export const EndField = styled.div<{ fontSize: number }>`
  font-size: ${({ fontSize }) => fontSize}px;
  font-weight: normal; // or bold? "2:43" looks normal/large
  color: #000;
`;
