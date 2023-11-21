import { styled } from '@superset-ui/core';

const StyledDotTitle = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  height: 100%;
`;

const StyledTitle = styled.div`
  font-size: 18px;
  font-weight: 700;
  line-height: 140%;
  letter-spacing: 0.2px;
`;

const StyledDotIcon = styled.div`
  position: relative;
  display: flex;
  height: 48px;
  width: 48px;
  background-color: ${({ theme }) => theme.colors.dvt.success.light2};
  border-radius: 12px;
  margin-right: 16px;
`;

const StyledDot = styled.div`
  height: 16px;
  width: 16px;
  background-color: ${({ theme }) => theme.colors.dvt.success.base};
  border-radius: 50px;
  margin: auto;
`;

export { StyledDotTitle, StyledDotIcon, StyledDot, StyledTitle };
