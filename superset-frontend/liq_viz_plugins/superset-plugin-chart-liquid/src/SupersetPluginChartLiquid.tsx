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
import React, { useMemo, createRef } from 'react';
import { styled } from '@superset-ui/core';
import { Liquid as AntvLiquid } from '@ant-design/plots';
import { LiquidStylesProps, LiquidProps } from './types';

// The following Styles component is a <div> element, which has been styled using Emotion
// For docs, visit https://emotion.sh/docs/styled

const Styles = styled.div<LiquidStylesProps>`
  height: ${({ height }) => height};
  width: ${({ width }) => width};
`;

/**
 * ******************* WHAT YOU CAN BUILD HERE *******************
 *  In essence, a chart is given a few key ingredients to work with:
 *  * Data: provided via `props.data`
 *  * A DOM element
 *  * FormData (your controls!) provided as props by transformProps.ts
 */

export default function SupersetPluginChartLiquid(props: LiquidProps) {
  const {shape, percentage, height, width } = props;

  const rootElem = createRef<HTMLDivElement>();

  const config = useMemo(() => ({
      percent: percentage,
      outline: {
        border: 2,
        distance: 4,
      },
      shape,
      wave: {
        length: 128,
      },
      width,
      height,
      autoFit: false,
    }),
    [height, width, percentage, shape],
  );

  return (
    <Styles
      ref={rootElem}
      height={height}
      width={width}
    >
      <AntvLiquid {...config} />
    </Styles>
  )

}
