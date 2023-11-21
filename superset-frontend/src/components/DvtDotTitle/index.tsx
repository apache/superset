import React from 'react';
import {
  StyledDotTitle,
  StyledDotIcon,
  StyledDot,
  StyledTitle,
} from './dvt-dot-title.module';

export interface DvtDotTitleProps {
  label?: string;
}

const DvtDotTitle = ({ label = '' }: DvtDotTitleProps) => {
  return (
    <StyledDotTitle>
      <StyledDotIcon>
        <StyledDot/>
      </StyledDotIcon>
      <StyledTitle>{label}</StyledTitle>
    </StyledDotTitle>
  );
};

export default DvtDotTitle;
