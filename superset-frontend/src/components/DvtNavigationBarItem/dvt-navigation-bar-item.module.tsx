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

interface StyledNavigationBarItemLabelProps {
  active: boolean;
  notActive: boolean;
}

const StyledNavigationBarItem = styled.div`
  display: flex;
  width: 250px;
  padding: 0px 24px;
  align-items: center;
  cursor: pointer;
`;

const StyledNavigationBarItemIcon = styled.div`
  margin-right: 16px;
`;

const StyledNavigationBarItemLabel = styled.div<StyledNavigationBarItemLabelProps>`
  color: ${({ active, notActive, theme }) =>
    notActive
      ? theme.colors.dvt.text.label
      : active
      ? theme.colors.dvt.primary.base
      : theme.colors.dvt.text.label};
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 0.2px;
  &:hover {
    color: ${({ theme }) => theme.colors.dvt.primary.base};
  }
`;

export {
  StyledNavigationBarItem,
  StyledNavigationBarItemIcon,
  StyledNavigationBarItemLabel,
};
