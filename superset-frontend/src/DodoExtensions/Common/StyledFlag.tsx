import { styled } from '@superset-ui/core';
import React from 'react';

const Flag = styled.i`
  margin-top: 2px;
`;

const StyledFlag = ({ language = 'gb' }: { language: string }) => (
  <div className="f16">
    <Flag className={`flag ${language}`} />
  </div>
);

export { StyledFlag };
