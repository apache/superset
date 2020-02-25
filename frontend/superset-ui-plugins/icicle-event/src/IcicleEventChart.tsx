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
import { BaseType, select as d3Select } from 'd3-selection';
import { IcicleEventNode } from './IcicleEventNode';
import { x0, y0, rectWidth, rectHeight } from './utils/RenderedIcicleAccessors';

interface Props {
  className?: string;
  width: number;
  height: number;
  boxMargin: {
    x: number;
    y: number;
  };
  color: (name: string) => string;
  contentRenderer: (
    datum: HierarchyRectangularNode<IcicleEventNode>,
    container: BaseType,
    rect: {
      width: number;
      height: number;
    },
  ) => void;
  d3TreeRoot: HierarchyRectangularNode<IcicleEventNode>;
  isVertical: boolean;
  rounding: number;
  transitionDuration: number;
}

function defaultContentRenderer(
  datum: HierarchyRectangularNode<IcicleEventNode>,
  container: HTMLDivElement,
  rect: { width: number; height: number },
) {
  const minRectHeight = 20;
  const minRectWidth = 10;

  d3Select(container)
    .attr('class', 'icicleContent')
    .style('text-overflow', 'ellipsis')
    .style('white-space', 'nowrap')
    .style('overflow', 'hidden')
    .style('font-size', `${rect.height / 2}px`)
    .style('line-height', `${rect.height}px`)
    .text(`${rect.height > minRectHeight && rect.width > minRectWidth ? datum.data.name : ''}`);
}

export default class IcicleEventChart extends Component<Props> {
  private chartRef = createRef<HTMLDivElement>();

  static defaultProps = {
    boxMargin: {
      x: 1,
      y: 3,
    },
    color: (name: string) => 'pink',
    contentRenderer: defaultContentRenderer,
  };

  constructor(props: Props) {
    super(props);

    this.renderIcicleChart = this.renderIcicleChart.bind(this);
  }

  componentDidMount() {
    this.renderIcicleChart();
  }

  // Check for changed data to rerender the icicle chart
  componentDidUpdate(prevProps: Props) {
    const root = this.props.d3TreeRoot;
    const prevRoot = prevProps.d3TreeRoot;

    if (root.data.id !== prevRoot.data.id || root.data.value !== prevRoot.data.value) {
      this.renderIcicleChart();
    }
  }

  // Creates chart using svg & chartRef to the div element
  renderIcicleChart() {
    const { boxMargin, color, contentRenderer, isVertical, width, height, rounding } = this.props;

    const root = this.props.d3TreeRoot;

    // Clear all elements and redraw the Icicle Chart
    d3Select(this.chartRef.current)
      .selectAll('*')
      .remove();

    const svg = d3Select(this.chartRef.current)
      .append('svg')
      .style('width', `${width}px`)
      .style('height', `${height}px`)
      .style('overflow', 'hidden');

    const cell = svg
      .selectAll('g')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr(
        'transform',
        d => `translate(${y0(isVertical, d) + boxMargin.x},${x0(isVertical, d) + boxMargin.y})`,
      )
      .attr('key', (d, i) => `${i}`);

    // Create the color coded rectangles for the events
    cell
      .append('rect')
      .attr('width', d => rectWidth(isVertical, boxMargin, d))
      .attr('height', d => rectHeight(isVertical, boxMargin, d))
      .attr('rx', rounding)
      .attr('fill', d => color(d.data.name ?? ''))
      .style('cursor', 'pointer');

    // Create container for each rectangle to append content (name of event)
    const content = cell
      .append('foreignObject')
      .classed('container', true)
      .attr('pointer-events', 'none')
      .style('width', d => `${rectWidth(isVertical, boxMargin, d)}px`)
      .style('height', d => `${rectHeight(isVertical, boxMargin, d)}px`)
      .style('padding', '0px')
      .style('overflow', 'hidden')
      .style('background', 'none');

    if (!isVertical) {
      content
        .attr('transform', d => `translate(${rectWidth(isVertical, boxMargin, d)}) rotate(90)`)
        .style('height', d => `${rectWidth(isVertical, boxMargin, d)}px`)
        .style('width', d => `${rectHeight(isVertical, boxMargin, d)}px`);
    }

    content
      .append('xhtml:div')
      .style('width', '100%')
      .style('height', '100%')
      .style('padding-left', '2px')
      .each((d, i, elements) =>
        contentRenderer(d, elements[i], {
          height: rectHeight(isVertical, boxMargin, d),
          width: rectWidth(isVertical, boxMargin, d),
        }),
      );
  }

  render() {
    return (
      <div>
        <div ref={this.chartRef} />
      </div>
    );
  }
}
