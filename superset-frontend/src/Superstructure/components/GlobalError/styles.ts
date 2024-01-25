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
const GlobalErrorWrapper = styled.div`
  height: auto;
  min-width: 50%;
  max-width: 85%;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
`;

const Alert = styled.div`
  line-height: 22px;
  color: #721c24;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  padding: 25px;
  width: 100%;
`;

const StyledCode = styled.code`
  padding: 2px 4px;
  font-size: 90%;
  border-radius: 4px;
  color: #028ffc;
  background-color: #f7f7f7;
`;

export { StyledH4, StyledP, GlobalErrorWrapper, Alert, StyledCode };
