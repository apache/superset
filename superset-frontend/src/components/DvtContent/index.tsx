import React from 'react';
import {
  StyledDvtContent,
  StyledDvtContentSubtitle,
  StyledDvtContentSubtitleP,
  StyledDvtContentTitle,
} from './dvt-content.module';

export interface DataProps {
  id: number;
  name: string;
  type: string;
  created: Date;
}

export interface DvtContentProps {
  title: string;
  header: string;
  data: DataProps[];
}

const DvtContent: React.FC<DvtContentProps> = ({title}) => {
  return (
    <StyledDvtContent>
      <StyledDvtContentTitle>{title}</StyledDvtContentTitle>
      <StyledDvtContentSubtitle>
        <StyledDvtContentSubtitleP>NAME</StyledDvtContentSubtitleP>
        <StyledDvtContentSubtitleP>TYPE</StyledDvtContentSubtitleP>
        <StyledDvtContentSubtitleP>CREATED</StyledDvtContentSubtitleP>
      </StyledDvtContentSubtitle>
    </StyledDvtContent>
  );
};

export default DvtContent;
