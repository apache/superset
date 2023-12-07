import { styled } from '@superset-ui/core';
import { Link } from 'react-router-dom';

const StyledDvtCardDetailChart = styled.div`
  display: flex;
  flex-direction: column;
  width: 400px;
  height: 172px;
  border-radius: 4px;
  padding: 10px;
  background-color: ${({ theme }) => theme.colors.dvt.grayscale.light2};
`;

const StyledDvtCardDetailChartTitle = styled.div`
  display: flex;
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 20px;
`;

const StyledDvtCardDetails = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: 10px;
`;

const StyledDvtCardLink = styled(Link)`
  font-weight: 500;
  font-size: 15px;
  color: ${({ theme }) => theme.colors.dvt.primary.base};
`;

const StyledDvtCardP = styled.p`
  font-size: 15px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.dvt.text.label};
`;
export {
  StyledDvtCardDetailChart,
  StyledDvtCardDetailChartTitle,
  StyledDvtCardDetails,
  StyledDvtCardLink,
  StyledDvtCardP,
};
