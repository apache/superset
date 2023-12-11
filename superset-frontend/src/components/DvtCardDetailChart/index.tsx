import React from 'react';
import {
  StyledDvtCardDetailChart,
  StyledDvtCardDetailChartTitle,
  StyledDvtCardDetails,
  StyledDvtCardLink,
  StyledDvtCardP,
} from './dvt-card-detail-chart.module';
import moment, { Moment } from 'moment';

export interface DvtCardDetailChartProps {
  labelTitle: string;
  vizType: string;
  dataset: string;
  modified: Moment;
  link?: string;
}

const DvtCardDetailChart: React.FC<DvtCardDetailChartProps> = ({
  labelTitle = 'Country of Citizenship',
  vizType,
  dataset,
  modified,
  link = '',
}) => {
  const formattedModified = getFormattedDifference(modified);

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
        <StyledDvtCardP>{formattedModified}</StyledDvtCardP>
      </StyledDvtCardDetails>
    </StyledDvtCardDetailChart>
  );
};

const getFormattedDifference = (modified: Moment) => {
  const now = moment();
  const diff = now.diff(modified);
  const duration = moment.duration(diff);

  const years = duration.years();
  const months = duration.months();
  const days = duration.days();
  const hours = duration.hours();
  const minutes = duration.minutes();

  if (years > 0) {
    return `${years} Years Ago`;
  } else if (months > 0) {
    return `${months} Months Ago`;
  } else if (days > 0) {
    return `${days} Days Ago`;
  } else if (hours > 0) {
    return `${hours} Hours Ago`;
  } else if (minutes > 0) {
    return `${minutes} Minutes Ago`;
  }
  return 'Just Now';
};
export default DvtCardDetailChart;
