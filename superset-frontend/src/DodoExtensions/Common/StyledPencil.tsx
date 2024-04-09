import { styled } from '@superset-ui/core';
import React from 'react';

const Pencil = styled.i`
  margin-left: 6px;
  margin-top: 6px;
  font-size: 12px;
`;

const StyledPencil = () => <Pencil className="fa fa-pencil" />;

export { StyledPencil };
