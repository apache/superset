import { styled } from '@superset-ui/core';

const StyledDvtPagination = styled.div`
  display: flex;
  align-items: center;
`;

const StyledDvtPaginationText = styled.div`
  margin-left: 13px;
  margin-right: 13px;
`;

const StyledDvtPaginationButton = styled.div`
  position: relative;
  display: flex;
  width: 95px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 12px;
  background-color: ${({ theme }) => theme.colors.dvt.primary.base};
`;

const StyledDvtPaginationIcon = styled.div`
  position: absolute;
  right: 0;
  display: flex;
  flex-direction: column;
  width: min-content;
  margin: 6px 9px 4.25px 0px;
`;

const StyledDvtPaginationPageNumber = styled.div`
  display: flex;
  align-items: center;
  margin: auto;
  color: ${({ theme }) => theme.colors.grayscale.light5};
  font-size: 24px;
  font-style: normal;
  font-weight: 500;
  line-height: normal;
`;

export {
  StyledDvtPagination,
  StyledDvtPaginationText,
  StyledDvtPaginationButton,
  StyledDvtPaginationIcon,
  StyledDvtPaginationPageNumber,
};
