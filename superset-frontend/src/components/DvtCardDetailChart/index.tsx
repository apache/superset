import React from 'react';
import moment from 'moment';
import {
  StyledDvtCardDetailChart,
  StyledDvtCardDetailChartTitle,
  StyledDvtCardDetails,
  StyledDvtCardLink,
  StyledDvtCardP,
} from './dvt-card-detail-chart.module';

export interface DvtCardDetailChartProps {
  labelTitle: string;
  vizTypeLabel: string;
  datasetLabel: string;
  datasetLink?: string;
  modified: Date;
}

const DvtCardDetailChart: React.FC<DvtCardDetailChartProps> = ({
  labelTitle,
  vizTypeLabel,
  datasetLabel,
  datasetLink = '',
  modified,
}) => {
  const getFormattedDifference = (modified: Date) => {
    const now = moment();
    const diff = now.diff(modified);
    const duration = moment.duration(diff);

    const years = duration.years();
    const months = duration.months();
    const days = duration.days();
    const hours = duration.hours();
    const minutes = duration.minutes();

    let dateMessage = 'Just Now';

    if (years > 0) {
      dateMessage = `${years} Years Ago`;
    } else if (months > 0) {
      dateMessage = `${months} Months Ago`;
    } else if (days > 0) {
      dateMessage = `${days} Days Ago`;
    } else if (hours > 0) {
      dateMessage = `${hours} Hours Ago`;
    } else if (minutes > 0) {
      dateMessage = `${minutes} Minutes Ago`;
    }
    return dateMessage;
  };

  return (
    <StyledDvtCardDetailChart>
      <StyledDvtCardDetailChartTitle>
        {labelTitle}
      </StyledDvtCardDetailChartTitle>
      <StyledDvtCardDetails>
        <StyledDvtCardP>Viz type</StyledDvtCardP>
        <StyledDvtCardP>{vizTypeLabel}</StyledDvtCardP>
      </StyledDvtCardDetails>
      <StyledDvtCardDetails>
        <StyledDvtCardP>Dataset</StyledDvtCardP>
        <StyledDvtCardLink to={datasetLink}>{datasetLabel}</StyledDvtCardLink>
      </StyledDvtCardDetails>
      <StyledDvtCardDetails>
        <StyledDvtCardP>Modified</StyledDvtCardP>
        <StyledDvtCardP>{getFormattedDifference(modified)}</StyledDvtCardP>
      </StyledDvtCardDetails>
    </StyledDvtCardDetailChart>
  );
};

export default DvtCardDetailChart;
