import { styled } from '@superset-ui/core';
import React from 'react';

export default function FooterSplitter() {
  const Line = styled.div`
    border-top: 1px solid lightgrey;
    height: 1px;
    width: 350px;
    margin-bottom: 20px;
    position: relative;
    top: 3%;
  `;

  return <Line />;
}
