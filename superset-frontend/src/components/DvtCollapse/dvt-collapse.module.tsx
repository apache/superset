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

interface StyledCollapseProps {
  isOpen: boolean;
}

const StyledCollapse = styled.div`
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
  width: 100%;
`;

const StyledCollapseGroup = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const StyledCollapseLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
`;

const StyledCollapseIcon = styled.div<StyledCollapseProps>`
  transition: transform 0.3s ease-in-out;
  transform: ${({ isOpen }) => (isOpen ? 'rotate(-180deg)' : 'none')};
`;

const StyledCollapseChildren = styled.div`
  animation: ${optionsKeyframes} 0.3s ease-in-out;
  transform-origin: top;
`;

const StyledCollapsePopover = styled.div``;

export {
  StyledCollapse,
  StyledCollapsePopover,
  StyledCollapseGroup,
  StyledCollapseLabel,
  StyledCollapseIcon,
  StyledCollapseChildren,
};
