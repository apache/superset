import { styled } from '@superset-ui/core';

const StyledDvtTitlePlus = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const DvtTitlePlusTitle = styled.p`
  font-size: 12px;
  font-style: normal;
  font-weight: 700;
  text-transform: uppercase;
  margin: 0;
  color: ${({ theme }) => theme.colors.dvt.text.label};
`;

export { StyledDvtTitlePlus, DvtTitlePlusTitle };
