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
/* eslint-disable theme-colors/no-literal-colors */
import { styled, t } from '@superset-ui/core';
import {
  VerticalLeftOutlined,
  VerticalRightOutlined,
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons';

const PaginationContainer = styled.div`
  ${({ theme }) => `
    border: 1px solid ${theme.colors.grayscale.light2};
    border-bottom-left-radius: ${theme.borderRadius * 2.5}px;
    border-bottom-right-radius: ${theme.borderRadius * 2.5}px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
    border-top: 1px solid ${theme.colors.grayscale.light2};
    font-size: ${theme.fontSize}px;
    color: ${theme.colorTextBase};
    transform: translateY(-${theme.sizeUnit}px);
    background: ${theme.colorBgContainer};
  `}
`;

const SelectWrapper = styled.div`
  ${({ theme }) => `
    position: relative;
    display: inline-block;
    min-width: ${theme.sizeUnit * 17}px;
  `}
`;

const StyledSelect = styled.select<{ numberLength: number }>`
  ${({ theme, numberLength }) => `
    width: auto;
    margin: 0 ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit}px ${theme.sizeUnit * 6}px ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
    border: 1px solid ${theme.colors.grayscale.light2};
    border-radius: ${theme.borderRadius}px;
    background: ${theme.colors.grayscale.light5};
    appearance: none;
    cursor: pointer;

    /* Custom arrow styling */
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23000000'%3e%3cpath d='M7 10l5 5 5-5z'/%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: right ${numberLength <= 2 ? `${theme.sizeUnit * 2}px` : `${theme.sizeUnit}px`} center;
    background-size: ${theme.sizeUnit * 6}px;

    &:hover {
      border-color: ${theme.colors.grayscale.dark1};
    }
  `}
`;

const PageInfo = styled.span`
  ${({ theme }) => `
    margin: 0 ${theme.sizeUnit * 6}px;
    span {
      font-weight: ${theme.fontWeightStrong};
    }
  `}
`;

const PageCount = styled.span`
  ${({ theme }) => `
    span {
      font-weight: ${theme.fontWeightStrong};
    }
  `}
`;

const ButtonGroup = styled.div`
  ${({ theme }) => `
    display: flex;
    gap: ${theme.sizeUnit * 3}px;
  `}
`;

interface PageButtonProps {
  disabled?: boolean;
}

const PageButton = styled.div<PageButtonProps>`
  ${({ theme, disabled }) => `
    cursor: ${disabled ? 'not-allowed' : 'pointer'};
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
      height: ${theme.sizeUnit * 3}px;
      width: ${theme.sizeUnit * 3}px;
      fill: ${disabled ? theme.colors.grayscale.light1 : theme.colors.grayscale.dark2};
    }
  `}
`;

interface PaginationProps {
  currentPage: number;
  pageSize: number;
  totalRows: number;
  pageSizeOptions: number[];
  onServerPaginationChange: (pageNumber: number, pageSize: number) => void;
  onServerPageSizeChange: (pageSize: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage = 0,
  pageSize = 10,
  totalRows = 0,
  pageSizeOptions = [10, 20, 50, 100, 200],
  onServerPaginationChange = () => {},
  onServerPageSizeChange = () => {},
}) => {
  const totalPages = Math.ceil(totalRows / pageSize);
  const startRow = currentPage * pageSize + 1;
  const endRow = Math.min((currentPage + 1) * pageSize, totalRows);

  const handleNextPage = (disabled: boolean) => () => {
    if (disabled) return;
    onServerPaginationChange(currentPage + 1, pageSize);
  };

  const handlePrevPage = (disabled: boolean) => () => {
    if (disabled) return;
    onServerPaginationChange(currentPage - 1, pageSize);
  };

  const handleNavigateToFirstPage = (disabled: boolean) => () => {
    if (disabled) return;
    onServerPaginationChange(0, pageSize);
  };

  const handleNavigateToLastPage = (disabled: boolean) => () => {
    if (disabled) return;
    onServerPaginationChange(totalPages - 1, pageSize);
  };

  return (
    <PaginationContainer>
      <span>{t('Page Size:')}</span>
      <SelectWrapper>
        <StyledSelect
          numberLength={pageSize.toString().length}
          onChange={e => {
            onServerPageSizeChange(Number(e.target.value));
          }}
          value={pageSize}
        >
          {pageSizeOptions.map(size => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </StyledSelect>
      </SelectWrapper>

      <PageInfo>
        <span>{startRow}</span> {t('to')} <span>{endRow}</span> {t('of')}{' '}
        <span>{totalRows}</span>
      </PageInfo>

      <ButtonGroup>
        <PageButton
          onClick={handleNavigateToFirstPage(currentPage === 0)}
          disabled={currentPage === 0}
        >
          <VerticalRightOutlined />
        </PageButton>
        <PageButton
          onClick={handlePrevPage(currentPage === 0)}
          disabled={currentPage === 0}
        >
          <LeftOutlined />
        </PageButton>
        <PageCount>
          {t('Page')} <span>{currentPage + 1}</span> {t('of')}{' '}
          <span>{totalPages}</span>
        </PageCount>
        <PageButton
          onClick={handleNextPage(!!(currentPage >= totalPages - 1))}
          disabled={currentPage >= totalPages - 1}
        >
          <RightOutlined />
        </PageButton>
        <PageButton
          onClick={handleNavigateToLastPage(!!(currentPage >= totalPages - 1))}
          disabled={currentPage >= totalPages - 1}
        >
          <VerticalLeftOutlined />
        </PageButton>
      </ButtonGroup>
    </PaginationContainer>
  );
};

export default Pagination;
