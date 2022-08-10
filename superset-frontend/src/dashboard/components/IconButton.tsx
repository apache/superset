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
import React, { MouseEventHandler } from 'react';
import { styled } from '@superset-ui/core';

interface IconButtonProps {
  icon: JSX.Element;
  label?: string;
  onClick: MouseEventHandler<HTMLDivElement>;
}

const StyledDiv = styled.div`
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.colors.grayscale.base};
  &:hover {
    color: ${({ theme }) => theme.colors.primary.base};
  }
`;

const StyledSpan = styled.span`
  margin-left: ${({ theme }) => theme.gridUnit * 2}px;
`;

const IconButton = ({ icon, label, onClick }: IconButtonProps) => (
  <StyledDiv
    tabIndex={0}
    role="button"
    onClick={e => {
      e.preventDefault();
      onClick(e);
    }}
  >
    {icon}
    {label && <StyledSpan>{label}</StyledSpan>}
  </StyledDiv>
);

export default IconButton;
