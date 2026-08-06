// @ts-nocheck
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
/* eslint-disable no-param-reassign, react/sort-prop-types */
import d3 from 'd3';
import {
  getNumberFormatter,
  CategoricalColorNamespace,
} from '@superset-ui/core';

interface ChordData {
  matrix: number[][];
  nodes: string[];
}

interface ChordProps {
  data: ChordData;
  width: number;
  height: number;
  colorScheme: string;
  numberFormat: string;
  sliceId: number;
}

function Chord(element: HTMLElement, props: ChordProps) {
  const { data, width, height, numberFormat, colorScheme, sliceId } = props;

  element.innerHTML = '';

  const div = d3.select(element);
  div.classed('superset-legacy-chart-chord', true);
  const { nodes, matrix } = data;
  const f = getNumberFormatter(numberFormat);
  const colorFn = CategoricalColorNamespace.getScale(colorScheme);

  const outerRadius = Math.min(width, height) / 2 - 10;
  const innerRadius = outerRadius - 24;

  // d3 v3 data-bound selections use any for the datum generic parameter
  // because the d3 v3 typings cannot represent the actual chord layout data types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let chord: d3.Selection<any>;

  const arc = d3.svg.arc().innerRadius(innerRadius).outerRadius(outerRadius);

  const layout = d3.layout
    .chord()
    .padding(0.04)
    .sortSubgroups(d3.descending)
    .sortChords(d3.descending);

  const path = d3.svg.chord().radius(innerRadius);

  const svg = div
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .on('mouseout', () => chord.classed('fade', false))
    .append('g')
    .attr('id', 'circle')
    .attr('transform', `translate(${width / 2}, ${height / 2})`);

  svg.append('circle').attr('r', outerRadius);

  // Compute the chord layout.
  layout.matrix(matrix);

  const group = svg
    .selectAll('.group')
    .data(layout.groups)
    .enter()
    .append('g')
    .attr('class', 'group')
    .on('mouseover', (d, i) => {
      chord.classed('fade', p => p.source.index !== i && p.target.index !== i);
    });

  // Add a mouseover title.
  group.append('title').text((d, i) => `${nodes[i]}: ${f(d.value)}`);

  // Add the group arc.
  const groupPath = group
    .append('path')
    .attr('id', (d, i) => `group${i}`)
    // @ts-expect-error -- d3 v3 arc layout is callable at runtime but not typed as Primitive
    .attr('d', arc)
    .style('fill', (d, i) => colorFn(nodes[i], sliceId));

  // Add a text label.
  const groupText = group.append('text').attr('x', 6).attr('dy', 15);

  groupText
    .append('textPath')
    .attr('xlink:href', (d, i) => `#group${i}`)
    .text((d, i) => nodes[i]);
  // Remove the labels that don't fit. :(
  groupText
    .filter(function filter(this: SVGTextElement, d, i) {
      return (
        (groupPath[0][i] as SVGPathElement).getTotalLength() / 2 - 16 <
        this.getComputedTextLength()
      );
    })
    .remove();

  // Add the chords.
  chord = svg
    .selectAll('.chord')
    .data(layout.chords)
    .enter()
    .append('path')
    .attr('class', 'chord')
    .on('mouseover', d => {
      chord.classed('fade', p => p !== d);
    })
    .style('fill', d => colorFn(nodes[d.source.index], sliceId))
    // @ts-expect-error -- d3 v3 chord layout is callable at runtime but not typed as Primitive
    .attr('d', path);

  // Add an elaborate mouseover title for each chord.
  chord
    .append('title')
    .text(
      d =>
        `${nodes[d.source.index]} \u2192 ${nodes[d.target.index]}: ${f(
          d.target.value,
        )}\n${nodes[d.target.index]} \u2192 ${nodes[d.source.index]}: ${f(
          d.source.value,
        )}`,
    );
}

Chord.displayName = 'Chord';

export default Chord;
