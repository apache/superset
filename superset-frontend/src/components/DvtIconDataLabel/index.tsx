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
import DvtButton from '../DvtButton';
import DvtLargeFile from '../../assets/images/icons/dvt-large-file.svg';
import DvtSquare from '../../assets/images/icons/dvt-square.svg';
import {
  StyledIconDataLabel,
  StyledIcon,
  StyledLabel,
  StyledButton,
  StyledDescription,
} from './dvt-icon-data-label.module';

export interface DvtIconDataLabelProps {
  label: string;
  buttonLabel?: string;
  icon?: 'file' | 'square';
  description?: string;
  buttonClick?: () => void;
}

const DvtIconDataLabel: React.FC<DvtIconDataLabelProps> = ({
  label,
  buttonLabel,
  icon = 'file',
  description,
  buttonClick = () => {},
}) => (
  <StyledIconDataLabel>
    <StyledIcon>
      {icon === 'square' && <DvtSquare />}
      {icon === 'file' && <DvtLargeFile />}
    </StyledIcon>
    <StyledLabel>{label}</StyledLabel>
    {description && <StyledDescription>{description}</StyledDescription>}

    {buttonLabel && (
      <StyledButton>
        <DvtButton label={buttonLabel} onClick={buttonClick} maxWidth />
      </StyledButton>
    )}
  </StyledIconDataLabel>
);

export default DvtIconDataLabel;
