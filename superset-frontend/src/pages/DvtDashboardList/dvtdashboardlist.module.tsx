import { styled } from '@superset-ui/core';

const StyledDashboardList = styled.div`
  flex: 1;
`;
const StyledDvtSelectButtons = styled.div`
  display: flex;
`;
const StyledDashboardButtons = styled.div`
  display: flex;
  gap: 16px;
  flex-direction: row;
  justify-content: flex-end;
`;
const StyledDashboardListButtons = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
`;
const StyledDashboardTable = styled.div``;

const StyledDashboardPagination = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const StyledDashboardCreateDashboard = styled.div`
  display: flex;
  justify-content: flex-start;
`;

const StyledDashboardBottom = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

export {
  StyledDashboardList,
  StyledDvtSelectButtons,
  StyledDashboardButtons,
  StyledDashboardListButtons,
  StyledDashboardTable,
  StyledDashboardPagination,
  StyledDashboardCreateDashboard,
  StyledDashboardBottom,
};
