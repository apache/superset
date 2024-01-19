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
const WarningPanelWrapper = styled.div`
  height: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
`;

const Alert = styled.div`
  line-height: 22px;
  color: #856404;
  background-color: #fff3cd;
  border: 1px solid #ffeeba;
  border-radius: 2px;
  padding: 25px;
  width: 100%;
`;

const StyledCode = styled.code`
  padding: 2px 4px;
  font-size: 90%;
  border-radius: 2px;
  color: #856404;
  background-color: #f7f7f7;
`;

export { StyledH4, StyledP, WarningPanelWrapper, Alert, StyledCode };
