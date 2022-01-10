import React from 'react';
import { styled } from '@superset-ui/core';

const DivComponent = styled.div`
  position: relative;
  bottom: 10px;
  left: 20px;
  width: 300px;
  font-size: 18px;
  font-weight: 600;
  text-align: center;
`;

export default function NoResult() {
  return (
    <DivComponent>
      No records found for this filter combination. Please select different Category and\or Tag
    </DivComponent>
  );
}
