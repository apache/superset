// DODO added #32232659

import { styled } from '@superset-ui/core';
import React, { FC } from 'react';

const Flag = styled.i<{ $pressToTheBottom: boolean }>`
  margin-top: ${props => props.$pressToTheBottom ?? '2px'};
`;

type Props = {
  language: string;
  style?: Record<string, string>;
  pressToTheBottom?: boolean;
};

const StyledFlag: FC<Props> = ({
  language = 'gb',
  style = {},
  pressToTheBottom = true,
}) => (
  <div style={style} className="f16">
    <Flag className={`flag ${language}`} $pressToTheBottom={pressToTheBottom} />
  </div>
);

export { StyledFlag };
