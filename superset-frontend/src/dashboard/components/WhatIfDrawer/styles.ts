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

import { styled } from '@apache-superset/core/ui';
import { Button } from '@superset-ui/core/components';
import { WHAT_IF_PANEL_WIDTH } from './constants';

export const PanelContainer = styled.div<{ topOffset: number }>`
  grid-column: 2;
  grid-row: 1 / -1; /* Span all rows */
  width: ${WHAT_IF_PANEL_WIDTH}px;
  min-width: ${WHAT_IF_PANEL_WIDTH}px;
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-left: 1px solid ${({ theme }) => theme.colorBorderSecondary};
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: sticky;
  top: ${({ topOffset }) => topOffset}px;
  height: calc(100vh - ${({ topOffset }) => topOffset}px);
  align-self: start;
  z-index: 10;
`;

export const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.sizeUnit * 3}px
    ${({ theme }) => theme.sizeUnit * 4}px;
  border-bottom: 1px solid ${({ theme }) => theme.colorBorderSecondary};
`;

export const PanelTitle = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  font-size: ${({ theme }) => theme.fontSizeLG}px;
`;

export const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: ${({ theme }) => theme.sizeUnit}px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colorTextSecondary};
  border-radius: ${({ theme }) => theme.borderRadius}px;

  &:hover {
    background-color: ${({ theme }) => theme.colorBgTextHover};
    color: ${({ theme }) => theme.colorText};
  }
`;

export const PanelContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.sizeUnit * 4}px;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit * 5}px;
`;

export const FormSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
`;

export const Label = styled.label`
  color: ${({ theme }) => theme.colorText};
`;

export const SliderContainer = styled.div`
  padding: 0 ${({ theme }) => theme.sizeUnit}px;
  & .ant-slider-mark {
    font-size: ${({ theme }) => theme.fontSizeSM}px;
  }
`;

export const ApplyButton = styled(Button)`
  width: 100%;
  min-height: 32px;
`;

export const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit}px;
`;

export const ModificationsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit * 5}px;
`;

export const ModificationTagsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
`;

export const AIBadge = styled.span`
  font-size: 10px;
  padding: 0 4px;
  background-color: ${({ theme }) => theme.colorInfo};
  color: ${({ theme }) => theme.colorWhite};
  border-radius: 16px;
  line-height: 1.2;
`;

export const AIReasoningSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit}px;
`;

export const AIReasoningToggle = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit}px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: ${({ theme }) => theme.colorTextTertiary};
  font-size: ${({ theme }) => theme.fontSizeSM}px;

  &:hover {
    color: ${({ theme }) => theme.colorText};
  }
`;

export const AIReasoningContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit}px;
  padding-left: ${({ theme }) => theme.sizeUnit * 4}px;
`;

export const AIReasoningItem = styled.div`
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  color: ${({ theme }) => theme.colorTextSecondary};
`;

export const ColumnSelectRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  align-items: flex-start;
`;

export const ColumnSelectWrapper = styled.div`
  flex: 1;
  min-width: 0;
`;

export const FilterButton = styled(Button)`
  flex-shrink: 0;
  padding: 0 ${({ theme }) => theme.sizeUnit * 2}px;
`;

export const FilterPopoverContent = styled.div`
  .edit-popover-resize {
    transform: scaleX(-1);
    float: right;
    margin-top: ${({ theme }) => theme.sizeUnit * 4}px;
    margin-right: ${({ theme }) => theme.sizeUnit * -1}px;
    color: ${({ theme }) => theme.colorIcon};
    cursor: nwse-resize;
  }
  .filter-sql-editor {
    border: ${({ theme }) => theme.colorBorder} solid thin;
  }
`;

export const FiltersSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
`;

export const FilterTagsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.sizeUnit}px;
`;
