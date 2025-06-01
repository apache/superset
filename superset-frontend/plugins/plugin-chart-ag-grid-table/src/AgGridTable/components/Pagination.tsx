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
import { styled } from '@superset-ui/core';
import {
  VerticalLeftOutlined,
  VerticalRightOutlined,
  LeftOutlined,
  RightOutlined,
  CaretDownOutlined,
} from '@ant-design/icons';

const PaginationContainer = styled.div`
  border: 1px solid #dcdddd;
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 8px 16px;
  border-top: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  transform: translateY(-5px);
  background: white;
`;

const SelectWrapper = styled.div`
  position: relative;
  display: inline-block;

  .ant-select-arrow {
    position: absolute;
    pointer-events: none;
    right: 35%;
    top: 12px;
  }
`;

const StyledSelect = styled.select`
  margin: 0 8px;
  padding: 2px 24px 2px 8px;
  border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: 4px;
  background: white;
  appearance: none;
  cursor: pointer;
`;

const StyledCaretDown = styled(CaretDownOutlined)`
  color: ${({ theme }) => theme.colors.grayscale.dark2};
  height: 14px;
  width: 14px;
`;

const PageInfo = styled.span`
  margin: 0 24px;
  span {
    font-weight: 500;
  }
`;

const PageCount = styled.span`
  span {
    font-weight: 500;
  }
`;
const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
`;

interface PageButtonProps {
  disabled?: boolean;
}

const PageButton = styled.div<PageButtonProps>`
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    height: 12px;
    width: 12px;
    fill: ${({ theme, disabled }) =>
      disabled ? theme.colors.grayscale.light1 : theme.colors.grayscale.dark2};
  }
`;

interface PaginationProps {
  currentPage: number;
  pageSize: number;
  totalRows: number;
  pageSizeOptions: number[];
  onServerPaginationChange: (pageNumber: number, pageSize: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage = 0,
  pageSize = 10,
  totalRows = 0,
  pageSizeOptions = [10, 20, 50, 100, 200],
  onServerPaginationChange = () => {},
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
      <span>Page Size:</span>
      <SelectWrapper>
        <StyledSelect value={pageSize}>
          {pageSizeOptions.map(size => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </StyledSelect>
        <span className="ant-select-arrow">
          <StyledCaretDown />
        </span>
      </SelectWrapper>

      <PageInfo>
        <span>{startRow}</span> to <span>{endRow}</span> of{' '}
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
          Page <span>{currentPage + 1}</span> of <span>{totalPages}</span>
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
