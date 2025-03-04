/* eslint-disable theme-colors/no-literal-colors */
import { css, styled } from '@superset-ui/core';
import { StylesConfig } from '../../types/global';

const StyledH4 = styled.h4`
  margin-top: 0;
  margin-left: 20px;
`;
const StyledP = styled.p`
  margin-bottom: 10px;
  &:last-child {
    margin-bottom: 0;
  }
`;
const InfoPanelWrapper = styled.div`
  height: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
`;

const Alert = styled.div<{
  stylesConfig: StylesConfig;
}>`
  ${({ stylesConfig: { colors } }) => css`
    line-height: 22px;
    color: ${colors.dark};
    background-color: ${colors.light};
    border-radius: 2px;
    padding: 30px;
    width: 100%;
  `}
`;

const StyledCode = styled.code`
  padding: 2px 4px;
  font-size: 90%;
  border-radius: 2px;
  color: #004085;
  background-color: #f7f7f7;
`;

export { StyledH4, StyledP, InfoPanelWrapper, Alert, StyledCode };
