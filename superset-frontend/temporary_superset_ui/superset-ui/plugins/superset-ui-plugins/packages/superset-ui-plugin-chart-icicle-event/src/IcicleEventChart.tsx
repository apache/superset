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
import React, { Component, createRef } from 'react';
import { HierarchyRectangularNode } from 'd3-hierarchy';
import { IcicleEventNode } from '../types/IcicleEventNode';

interface Props {
  className?: string;
  width: number;
  height: number;
  boxMargin: {
    x: number;
    y: number;
  };
  color: (name: string) => string;
  contentRenderer: () => void;
  d3TreeRoot: HierarchyRectangularNode<IcicleEventNode>;
  isVertical: boolean;
  rounding: number;
  transitionDuration: number;
}

export default class IcicleEventChart extends Component<Props> {
  private chartRef = createRef<HTMLDivElement>();

  constructor(props: Props) {
    super(props);

    this.renderIcicleChart = this.renderIcicleChart.bind(this);
  }

  componentDidMount() {
    this.renderIcicleChart();
  }

  // Check for changed data to rerender the icicle chart
  componentDidUpdate(prevProps: Props) {}

  // Creates chart using svg & chartRef to the div element
  renderIcicleChart() {}

  render() {
    return (
      <div>
        <div ref={this.chartRef} />
      </div>
    );
  }
}
