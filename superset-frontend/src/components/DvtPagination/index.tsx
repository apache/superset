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
import React from 'react';
import { DownOutlined, UpOutlined } from '@ant-design/icons';
import { SupersetTheme } from '@superset-ui/core';
import {
  StyledDvtPagination,
  StyledDvtPaginationText,
  StyledDvtPaginationButton,
  StyledDvtPaginationIcon,
  StyledDvtPaginationPageNumber,
} from './dvt-pagination.module';

export interface DvtPaginationProps {
  page: number;
  setPage: (newPage: number) => void;
  itemSize: number;
  pageItemSize: number;
}

const DvtPagination: React.FC<DvtPaginationProps> = ({
  page = 1,
  setPage,
  itemSize,
  pageItemSize,
}) => {
  const totalPages = Math.ceil(itemSize / pageItemSize);

  const handlePageChange = (newPage: number) => {
    if (newPage !== page && newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  return (
    <StyledDvtPagination>
      <StyledDvtPaginationText>Page</StyledDvtPaginationText>
      <StyledDvtPaginationButton>
        <StyledDvtPaginationPageNumber>{page}</StyledDvtPaginationPageNumber>
        <StyledDvtPaginationIcon>
          <UpOutlined
            css={(theme: SupersetTheme) => ({
              fontSize: '15.75px',
              color: theme.colors.grayscale.light5,
            })}
            onClick={() => handlePageChange(page + 1)}
          />
          <DownOutlined
            css={(theme: SupersetTheme) => ({
              fontSize: '15.75px',
              color: theme.colors.grayscale.light5,
            })}
            onClick={() => handlePageChange(page - 1)}
          />
        </StyledDvtPaginationIcon>
      </StyledDvtPaginationButton>
      <StyledDvtPaginationText>
        {'of '}
        {totalPages}
      </StyledDvtPaginationText>
    </StyledDvtPagination>
  );
};

export default DvtPagination;
