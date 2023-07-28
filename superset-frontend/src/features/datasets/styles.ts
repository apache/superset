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
import { styled, css, SupersetTheme } from '@superset-ui/core';

export const StyledLayoutWrapper = styled.div`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
`;

export const LeftColumn = styled.div<{ width?: number }>`
  width: ${({ theme, width }) => width ?? theme.gridUnit * 80}px;
  max-width: ${({ theme, width }) => width ?? theme.gridUnit * 80}px;
  flex-direction: column;
  flex: 1 0 auto;
`;

export const RightColumn = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
`;

const Row = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
`;

export const OuterRow = styled(Row)`
  flex: 1 0 auto;
  position: relative;
`;

export const PanelRow = styled(Row)`
  flex: 1 0 auto;
  height: auto;
`;

export const FooterRow = styled(Row)`
  flex: 0 0 auto;
  height: ${({ theme }) => theme.gridUnit * 16}px;
  z-index: 0;
`;

export const StyledLayoutHeader = styled.div`
  ${({ theme }) => `
  flex: 0 0 auto;
  height: ${theme.gridUnit * 16}px;
  border-bottom: 2px solid ${theme.colors.grayscale.light2};

  .header-with-actions {
    height: ${theme.gridUnit * 15.5}px;
  }
  `}
`;

export const StyledCreateDatasetTitle = styled.div`
  ${({ theme }) => `
  margin: ${theme.gridUnit * 4}px;
  font-size: ${theme.typography.sizes.xl}px;
  font-weight: ${theme.typography.weights.bold};
  `}
`;

export const StyledLayoutLeftPanel = styled.div`
  ${({ theme }) => `
  height: 100%;
  border-right: 1px solid ${theme.colors.grayscale.light2};
  `}
`;

export const StyledLayoutDatasetPanel = styled.div`
  width: 100%;
  position: relative;
`;

export const StyledLayoutRightPanel = styled.div`
  ${({ theme }) => `
  border-left: 1px solid ${theme.colors.grayscale.light2};
  color: ${theme.colors.success.base};
  `}
`;

export const StyledLayoutFooter = styled.div`
  ${({ theme }) => `
  height: ${theme.gridUnit * 16}px;
  width: 100%;
  border-top: 1px solid ${theme.colors.grayscale.light2};
  border-bottom: 1px solid ${theme.colors.grayscale.light2};
  color: ${theme.colors.info.base};
  border-top: ${theme.gridUnit / 4}px solid
    ${theme.colors.grayscale.light2};
  padding: ${theme.gridUnit * 4}px;
  display: flex;
  justify-content: flex-end;
  background-color: ${theme.colors.grayscale.light5};
  z-index: ${theme.zIndex.max}
  `}
`;

export const HeaderComponentStyles = styled.div`
  .ant-btn {
    span {
      margin-right: 0;
    }

    &:disabled {
      svg {
        color: ${({ theme }) => theme.colors.grayscale.light1};
      }
    }
  }
`;

export const disabledSaveBtnStyles = (theme: SupersetTheme) => css`
  width: ${theme.gridUnit * 21.5}px;

  &:disabled {
    background-color: ${theme.colors.grayscale.light3};
    color: ${theme.colors.grayscale.light1};
  }
`;
