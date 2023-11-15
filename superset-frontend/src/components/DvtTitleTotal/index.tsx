import React from 'react';
import {
  DvtTitle,
  DvtTotal,
  StyledDvtTitleTotal,
} from './dvt-title-total.module';

export interface DvtTitleTotalProps {
  total: number;
  title: string;
}

const DvtTitleTotal: React.FC<DvtTitleTotalProps> = ({ total = 0, title }) => (
  <StyledDvtTitleTotal>
    <DvtTitle>{title}</DvtTitle>
    <DvtTotal>{`(${total})`}</DvtTotal>
  </StyledDvtTitleTotal>
);

export default DvtTitleTotal;
