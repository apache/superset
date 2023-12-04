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

const StyledCalendar = styled.div`
  width: 308px;
  tr {
    th {
      font-weight: 600;
      text-align: center;
    }
  }
  tbody {
    tr {
      &:last-of-type {
        display: none;
      }
    }
  }
`;

const StyledCalendarIcon = styled.div`
  padding: 8px;
  display: flex;
  align-items: center;
`;
interface StyledCalendarDateCellProps {
  isSelected: boolean;
}

const StyledCalendarDateCell = styled.div<StyledCalendarDateCellProps>`
  position: relative;
  background-color: ${({ isSelected, theme }) =>
    isSelected ? theme.colors.dvt.primary.base : ''};
  border-radius: 50px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: ${({ isSelected, theme }) =>
    isSelected
      ? `4px 8px 18px 0px ${theme.colors.dvt.boxShadow.primaryLight3}`
      : ''};
  color: ${({ isSelected, theme }) =>
    isSelected ? theme.colors.grayscale.light5 : ''};
`;

const StyledCalendarDateCellClick = styled.div`
  width: 40px;
  height: 40px;
  position: absolute;
  top: 0;
  left: 0;
  opacity: 1;
  z-index: 999;
`;

export {
  StyledCalendar,
  StyledCalendarIcon,
  StyledCalendarDateCell,
  StyledCalendarDateCellClick,
};
