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
import React, { ReactNode, useState } from 'react';
import {
  StyledPopper,
  StyledPopperUp,
  StyledPopperDown,
  StyledPopperLeft,
  StyledPopperRight,
  StyledPopperBody,
  StyledPopperGroup,
  StyledPopperAbsolute,
} from './dvt-popper.module';

export interface DvtPopperProps {
  label: string;
  children: ReactNode;
  direction?: 'top' | 'bottom' | 'left' | 'right';
}

const DvtPopper: React.FC<DvtPopperProps> = ({
  label,
  children,
  direction='bottom',
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <StyledPopperGroup
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <StyledPopper>{children} </StyledPopper>

      {isHovered && (
        <StyledPopperAbsolute direction={direction}>
          {direction === 'bottom' && <StyledPopperUp />}
          {direction === 'right' && <StyledPopperLeft />}
          <StyledPopperBody>{label}</StyledPopperBody>
          {direction === 'top' && <StyledPopperDown />}{' '}
          {direction === 'left' && <StyledPopperRight />}
        </StyledPopperAbsolute>
      )}
    </StyledPopperGroup>
  );
};

export default DvtPopper;
