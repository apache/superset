/* eslint-disable theme-colors/no-literal-colors */
import { css, styled } from '@superset-ui/core';
import { StylesConfig } from '../../types/global';

const ButtonsWrapper = styled.div`
  display: flex;
  justify-content: flex-start;
  margin-top: 20px;
`;

const Button = styled.a<{
  stylesConfig: StylesConfig;
}>`
  ${({ stylesConfig: { colors } }) => css`
    border: 1px solid ${colors.primary};
    color: ${colors.dark};
    background-color: ${colors.secondary};
    border-radius: 2px;

    &:hover {
      opacity: 0.8;
      background-color: ${colors.primary};
      color: ${colors.light};
    }

    &:first-child {
      margin-right: 20px;
    }
  `}
`;

export { ButtonsWrapper, Button };
