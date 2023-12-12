import { styled } from '@superset-ui/core';
import { Link } from 'react-router-dom';

const StyledDvtCardDetailChart = styled.div`
  display: flex;
  flex-direction: column;
  border-radius: 4px;
  padding: 19px;
  gap: 20px;
  background-color: ${({ theme }) => theme.colors.dvt.grayscale.light2};
`;

const StyledDvtCardDetailChartTitle = styled.div`
  display: flex;
  font-size: 16px;
  font-weight: bold;
  line-height: 100%;
`;

const StyledDvtCardDetails = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

const StyledDvtCardLink = styled(Link)`
  font-size: 15px;
  font-weight: 500;
  line-height: 100%;
  color: ${({ theme }) => theme.colors.dvt.primary.base};
`;

const StyledDvtCardP = styled.p`
  font-size: 15px;
  font-weight: 500;
  line-height: 100%;
  color: ${({ theme }) => theme.colors.dvt.text.label};
  margin: 0;
`;

export {
  StyledDvtCardDetailChart,
  StyledDvtCardDetailChartTitle,
  StyledDvtCardDetails,
  StyledDvtCardLink,
  StyledDvtCardP,
};
