import { styled } from '@superset-ui/core';

const StyledTable = styled.div`
  background: ${({ theme }) => theme.colors.dvt.grayscale.light2};
  padding: 32px;
`;

const StyledTableTable = styled.table`
  height: 100%;
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 20px;
`;

const StyledTabletHead = styled.thead``;

const StyledTableIcon = styled.div`
  display: flex;
`;

const StyledTableTr = styled.tr`
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.grayscale.light5};
  height: 56px;
  margin-bottom: 20px;
  cursor: pointer;
  &:hover {
    background-color: ${({ theme }) => theme.colors.dvt.primary.light2};
  }
`;

const StyledTableTitle = styled.tr``;

interface StyledTableThProps {
  flex: number;
}

const StyledTableTh = styled.th<StyledTableThProps>`
  color: ${({ theme }) => theme.colors.grayscale.dark2};
  font-size: 16px;
  font-weight: 600;
  padding-bottom: 28px;
  padding-left: 3px;
  width: ${({ flex }) => (flex ? `${flex}%` : 'auto')};
  &:first-of-type {
    padding-left: 33px;
  }
`;

const StyledTableTbody = styled.tbody``;

interface StyledTableTdProps {
  $onLink: boolean;
}

const StyledTableTd = styled.td<StyledTableTdProps>`
  color: ${({ $onLink, theme }) =>
    $onLink ? theme.colors.dvt.primary.base : theme.colors.grayscale.dark2};
  font-size: 14px;
  font-weight: 400;
  &:first-of-type {
    border-top-left-radius: 12px;
    border-bottom-left-radius: 12px;
    padding-left: 30px;
  }
  &:last-of-type {
    border-top-right-radius: 12px;
    border-bottom-right-radius: 12px;
  }
`;

const StyledTablePagination = styled.div`
  display: flex;
  justify-content: flex-end;
  padding-right: 13px;
  padding-top: 55px;
`;

export {
  StyledTable,
  StyledTableTable,
  StyledTabletHead,
  StyledTableTr,
  StyledTableTh,
  StyledTableTbody,
  StyledTableTd,
  StyledTablePagination,
  StyledTableTitle,
  StyledTableIcon,
};
