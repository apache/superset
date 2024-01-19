/* eslint-disable theme-colors/no-literal-colors */
import { styled } from '@superset-ui/core';

const StyledH4 = styled.h4`
  margin-top: 0;
  margin-bottom: 20px;
`;
const StyledP = styled.p`
  margin-bottom: 10px;
  &:last-child {
    margin-bottom: 0;
  }
`;
const ServiceNotAvailableWrapper = styled.div`
  height: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  max-width: 60%;
`;

const Alert = styled.div`
  line-height: 22px;
  color: #1b1e21;
  border-radius: 2px;
  padding: 25px;
  width: 100%;
`;

export { StyledH4, StyledP, ServiceNotAvailableWrapper, Alert };
