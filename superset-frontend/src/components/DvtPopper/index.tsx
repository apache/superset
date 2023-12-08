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
import React, { ReactNode } from 'react';
import {
  StyledPopper,
  StyledPopperUp,
  StyledPopperBody,
  StyledPopperGroup,
  StyledPopperAbsolute,
} from './dvt-popper.module';

export interface DvtPopperProps {
  label: string;
  children: ReactNode;
  isOpen: boolean;
  setIsOpen: (newOpen: boolean) => void;
  onClick: () => void;
  top?: number;
  bottom?: number;
  right?: number;
  left?: number;
}

const DvtPopper: React.FC<DvtPopperProps> = ({
  label,
  children,
  isOpen,
  setIsOpen,
  top = 0,
  bottom,
  right = 0,
  left = 0,
  onClick,
}) => {
  const handleMouseEnter = () => {
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    setIsOpen(false);
  };

  return (
    <StyledPopperGroup
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <StyledPopper>
        {children}
        {isOpen && (
          <StyledPopperAbsolute
            top={top}
            bottom={bottom}
            right={right}
            left={left}
          >
            <StyledPopperUp />
            <StyledPopperBody onClick={onClick}>{label}</StyledPopperBody>
          </StyledPopperAbsolute>
        )}
      </StyledPopper>
    </StyledPopperGroup>
  );
};

export default DvtPopper;
