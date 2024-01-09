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
import { keyframes, styled } from '@superset-ui/core';

const optionsKeyframes = keyframes`
  from {
    transform: scaleY(0);
  }
  to {
    transform: scaleY(1);
  }
`;

const StyledDropdown = styled.div`
  position: absolute;
  top: calc(100% + 2px);
  left: 9px;
`;

const DropdownMenu = styled.div`
  display: flex;
  flex-direction: column;
  box-shadow: 1px 1px 3px ${({ theme }) => theme.colors.dvt.text.label};
  transform-origin: top;
  animation: ${optionsKeyframes} 0.3s ease-in-out;
  border-radius: 4px;
  padding: 4px 0;
`;

const DropdownOption = styled.div`
  display: flex;
  gap: 10px;
  align-items: end;
  padding: 5px 12px;

  &:hover {
    background-color: ${({ theme }) => theme.colors.dvt.grayscale.light1};
  }
`;

const StyledDropdownGroup = styled.div`
  position: relative;
`;

export { StyledDropdown, DropdownMenu, DropdownOption, StyledDropdownGroup };
