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
import { Select } from '@superset-ui/core/components';

const PaginationContainer = styled.div`
  ${({ theme }) => `
    border: 1px solid ${theme.colors.grayscale.light2};
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
    border-top: 1px solid ${theme.colors.grayscale.light2};
    font-size: ${theme.fontSize}px;
    color: ${theme.colorTextBase};
    transform: translateY(-${theme.sizeUnit}px);
    background: ${theme.colorBgBase};
  `}
`;

const SelectWrapper = styled.div`
  ${({ theme }) => `
    position: relative;
    margin-left: ${theme.sizeUnit * 2}px;
    display: inline-block;
    min-width: ${theme.sizeUnit * 17}px;
    overflow: hidden;
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
  sliceId: number;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage = 0,
  pageSize = 10,
  totalRows = 0,
  pageSizeOptions = [10, 20, 50, 100, 200],
  onServerPaginationChange = () => {},
  onServerPageSizeChange = () => {},
  sliceId,
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

  const selectOptions = pageSizeOptions.map(size => ({
    value: size,
    label: size,
  }));

  return (
    <PaginationContainer>
      <span>{t('Page Size:')}</span>
      <SelectWrapper>
        <Select
          value={`${pageSize}`}
          options={selectOptions}
          onChange={(value: string) => {
            onServerPageSizeChange(Number(value));
          }}
          getPopupContainer={() =>
            document.getElementById(`chart-id-${sliceId}`) as HTMLElement
          }
        />
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
