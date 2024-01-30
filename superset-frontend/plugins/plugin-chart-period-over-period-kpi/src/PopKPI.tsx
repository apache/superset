/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React, { useEffect, createRef } from 'react';
import { 
  styled,
  } from '@superset-ui/core';
import { PopKPIProps, PopKPIStylesProps } from './types';

// The following Styles component is a <div> element, which has been styled using Emotion
// For docs, visit https://emotion.sh/docs/styled

// Theming variables are provided for your use via a ThemeProvider
// imported from @superset-ui/core. For variables available, please visit
// https://github.com/apache-superset/superset-ui/blob/master/packages/superset-ui-core/src/style/index.ts

const Styles = styled.div<PopKPIStylesProps>`

  font-family: ${({ theme }) => theme.typography.families.sansSerif};
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: ${({ theme }) => theme.tdUnit * 4}px;
  border-radius: ${({ theme }) => theme.tdUnit * 2}px;
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
`;

const BigValueContainer = styled.div`
  font-size: ${props=> props.headerFontSize ? props.headerFontSize : 60}px;
  font-weight: ${({ theme }) => theme.typography.weights.normal};
  text-align: center;
`;

const TableContainer = styled.div`
  width: 100%;
  display: table;
`

const ComparisonContainer = styled.div`
  display: table-row;
`;

const ComparisonValue = styled.div`
  font-weight: ${({ theme }) => theme.typography.weights.light};
  width: 33%;
  display: table-cell;
  font-size: ${props=> props.subheaderFontSize ? props.subheaderFontSize : 20}px;
  text-align: center;
`;

export default function PopKPI(props: PopKPIProps) {
  const {
    height,
    width,
    bigNumber,
    prevNumber,
    valueDifference,
    percentDifference,
    headerFontSize,
    subheaderFontSize,
  } = props;

  const rootElem = createRef<HTMLDivElement>();

  useEffect(() => {
    const root = rootElem.current as HTMLElement;
  });

  return (
    <Styles
      ref={rootElem}
      boldText={props.boldText}
      headerFontSize={props.headerFontSize}
      height={height}
      width={width}
    >

      <BigValueContainer headerFontSize={headerFontSize}>{bigNumber}</BigValueContainer>
      <TableContainer>
        <ComparisonContainer>
          <ComparisonValue subheaderFontSize={subheaderFontSize}> #: {prevNumber}</ComparisonValue>
          <ComparisonValue subheaderFontSize={subheaderFontSize}> Δ: {valueDifference}</ComparisonValue>
          <ComparisonValue subheaderFontSize={subheaderFontSize}> %: {percentDifference}</ComparisonValue>
        </ComparisonContainer>
      </TableContainer>
    </Styles>
  );
}
