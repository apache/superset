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
import React from 'react';
import { StyledDvtButton } from './dvt-button.module';
import Icon from '../Icons/Icon';

export interface DvtButtonProps {
  label: string;
  icon?: string;
  size?: 'small' | 'medium' | 'large';
  onClick: () => void;
  colour?: 'primary' | 'success' | 'grayscale' | 'error';
  typeColour?: 'basic' | 'powder' | 'outline';
  maxWidth?: boolean;
  iconToRight?: boolean;
  bold?: boolean;
}

const DvtButton: React.FC<DvtButtonProps> = ({
  label,
  icon,
  size = 'medium',
  onClick,
  colour = 'primary',
  typeColour = 'basic',
  maxWidth = false,
  iconToRight = false,
  bold = false,
}) => (
  <StyledDvtButton
    $size={size}
    $maxWidth={maxWidth}
    $colour={colour}
    $typeColour={typeColour}
    onClick={onClick}
    $bold={bold}
    $iconToRight={iconToRight}
  >
    {label}
    {icon && <Icon fileName={icon} iconSize="l" />}
  </StyledDvtButton>
);

export default DvtButton;
