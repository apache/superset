/* eslint-disable theme-colors/no-literal-colors */
import { styled } from '@superset-ui/core';

const StyledH4 = styled.h4`
  margin-top: 0;
`;
const StyledP = styled.p`
  margin-bottom: 10px;
  &:last-child {
    margin-bottom: 0;
  }
`;
const LimitWarningWrapper = styled.div`
  width: 100%;
  height: 100%;
  min-height: 100%;
  display: flex;
  position: absolute;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
`;

const Alert = styled.div`
  line-height: 22px;
  color: #856404;
  background-color: #fff3cd;
  border: 1px solid #ffeeba;
  border-radius: 4px;
  padding: 25px;
`;

export { StyledH4, StyledP, LimitWarningWrapper, Alert };
