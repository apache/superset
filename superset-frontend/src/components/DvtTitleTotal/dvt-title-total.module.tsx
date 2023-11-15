import { styled } from '@superset-ui/core';

const StyledDvtTitleTotal = styled.div`
  gap: 5px;
  display: flex;
  align-items: center;
`;

const DvtTitle = styled.p`
  color: ${({ theme }) => theme.colors.dvt.text.bold};
  font-size: 16px;
  font-style: normal;
  font-weight: 700;
  letter-spacing: 0.2px;
  margin: 0;
`;

const DvtTotal = styled.p`
  color: ${({ theme }) => theme.colors.dvt.text.label};
  font-size: 16px;
  font-style: normal;
  font-weight: 400;
  margin: 0;
`;

export { StyledDvtTitleTotal, DvtTotal, DvtTitle };
