import React from 'react';
import {
  StyledDvtCardDetailChart,
  StyledDvtCardDetailChartTitle,
  StyledDvtCardDetails,
  StyledDvtCardLink,
  StyledDvtCardP,
} from './dvt-card-detail-chart.module';

export interface DvtCardDetailChartProps {
  labelTitle: string;
  vizType: string;
  dataset: string;
  modified: string;
  link?: string;
}

const DvtCardDetailChart: React.FC<DvtCardDetailChartProps> = ({
  labelTitle = 'Country of Citizenship',
  vizType,
  dataset,
  modified,
  link = '',
}) => {
  return (
    <StyledDvtCardDetailChart>
      <StyledDvtCardDetailChartTitle>
        {labelTitle}
      </StyledDvtCardDetailChartTitle>
      <StyledDvtCardDetails>
        <StyledDvtCardP>Viz type</StyledDvtCardP>
        <StyledDvtCardP>{vizType}</StyledDvtCardP>
      </StyledDvtCardDetails>
      <StyledDvtCardDetails>
        <StyledDvtCardP>Dataset</StyledDvtCardP>
        <StyledDvtCardLink to={link}>{dataset}</StyledDvtCardLink>
      </StyledDvtCardDetails>
      <StyledDvtCardDetails>
        <StyledDvtCardP>Modified</StyledDvtCardP>
        <StyledDvtCardP>{modified}</StyledDvtCardP>
      </StyledDvtCardDetails>
    </StyledDvtCardDetailChart>
  );
};

export default DvtCardDetailChart;
