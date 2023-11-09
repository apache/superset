import React from 'react';
import { StyledDvtPagination } from './dvt-pagination.module';

export interface DvtPaginationProps {
  page: number;
}

const DvtPagination: React.FC<DvtPaginationProps> = ({ page = 1 }) => (
  <StyledDvtPagination>{page}</StyledDvtPagination>
);

export default DvtPagination;
