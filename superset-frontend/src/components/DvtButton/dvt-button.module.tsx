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
import { styled } from '@superset-ui/core';

interface DvtButtonProps {
  $label?: string;
  $size: 'small' | 'medium' | 'large';
  $colour: 'primary' | 'success' | 'grayscale';
  $typeColour: 'basic' | 'powder' | 'outline';
  $maxWidth?: boolean;
}

interface SizeProps {
  small: {
    size: number;
  };
  medium: {
    size: number;
  };
  large: {
    size: number;
  };
}

const sizes: SizeProps = {
  small: {
    size: 40,
  },
  medium: {
    size: 44,
  },
  large: {
    size: 56,
  },
};

const StyledDvtButton = styled.button<DvtButtonProps>`
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  gap: 8px;
  ${({ $maxWidth }) => $maxWidth && `width: 100%;`};
  height: ${({ $size }) => `${sizes[$size].size}px`};
  padding: 0 12px;
  border-radius: 8px;
  border: none;
  ${({ $typeColour, $colour, theme }) => {
    const colourFinder = {
      primary: {
        basic: 'base',
        powder: 'light3',
      },
      success: {
        basic: 'dark1',
        powder: 'light3',
      },
      grayscale: {
        basic: 'base',
        powder: 'light2',
      },
    };

    const colourFinderColor = {
      primary: {
        powder: 'base',
        outline: 'base',
      },
      success: {
        powder: 'base',
        outline: 'dark2',
      },
      grayscale: {
        powder: 'base',
        outline: 'base',
      },
    };

    return `
      background-color: ${
        $typeColour === 'outline'
          ? 'transparent'
          : theme.colors.dvt[$colour][colourFinder[$colour][$typeColour]]
      };
      color: ${
        $typeColour === 'basic'
          ? theme.colors.grayscale.light5
          : theme.colors.dvt[$colour][colourFinderColor[$colour][$typeColour]]
      };
    `;
  }};
`;
export { StyledDvtButton };
