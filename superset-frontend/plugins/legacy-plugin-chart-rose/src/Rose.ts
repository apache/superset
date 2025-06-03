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
/* eslint no-use-before-define: ["error", { "functions": false }] */
/* eslint-disable no-restricted-syntax */
/* eslint-disable react/sort-prop-types */
import d3 from 'd3';
import PropTypes from 'prop-types';
// @ts-expect-error TS(7016): Could not find a declaration file for module 'nvd3... Remove this comment to see the full error message
import nv from 'nvd3-fork';
import {
  getTimeFormatter,
  getNumberFormatter,
  CategoricalColorNamespace,
} from '@superset-ui/core';

const propTypes = {
  // Data is an object hashed by numeric value, perhaps timestamp
  data: PropTypes.objectOf(
    PropTypes.arrayOf(
      PropTypes.shape({
        key: PropTypes.arrayOf(PropTypes.string),
        name: PropTypes.arrayOf(PropTypes.string),
        time: PropTypes.number,
        value: PropTypes.number,
      }),
    ),
  ),
  width: PropTypes.number,
  height: PropTypes.number,
  dateTimeFormat: PropTypes.string,
  numberFormat: PropTypes.string,
  useRichTooltip: PropTypes.bool,
  useAreaProportions: PropTypes.bool,
  colorScheme: PropTypes.string,
};

function copyArc(d: $TSFixMe) {
  return {
    startAngle: d.startAngle,
    endAngle: d.endAngle,
    innerRadius: d.innerRadius,
    outerRadius: d.outerRadius,
  };
}

function sortValues(a: $TSFixMe, b: $TSFixMe) {
  if (a.value === b.value) {
    return a.name > b.name ? 1 : -1;
  }

  return b.value - a.value;
}

function Rose(element: $TSFixMe, props: $TSFixMe) {
  const {
    data,
    width,
    height,
    colorScheme,
    dateTimeFormat,
    numberFormat,
    useRichTooltip,
    useAreaProportions,
    sliceId,
  } = props;

  const div = d3.select(element);
  div.classed('superset-legacy-chart-rose', true);

  const datum = data;
  const times = Object.keys(datum)
    .map(t => parseInt(t, 10))
    .sort((a, b) => a - b);
  const numGrains = times.length;
  const numGroups = datum[times[0]].length;
  const format = getNumberFormatter(numberFormat);
  const timeFormat = getTimeFormatter(dateTimeFormat);
  const colorFn = CategoricalColorNamespace.getScale(colorScheme);

  d3.select('.nvtooltip').remove();
  div.selectAll('*').remove();

  const arc = d3.svg.arc();
  const legend = nv.models.legend();
  const tooltip = nv.models.tooltip();
  const state = { disabled: datum[times[0]].map(() => false) };

  const svg = div.append('svg').attr('width', width).attr('height', height);

  const g = svg.append('g').attr('class', 'rose').append('g');

  const legendWrap = g.append('g').attr('class', 'legendWrap');

  function legendData(adatum: $TSFixMe) {
    // @ts-expect-error TS(7006): Parameter 'v' implicitly has an 'any' type.
    return adatum[times[0]].map((v, i) => ({
      disabled: state.disabled[i],
      key: v.name,
    }));
  }

  function tooltipData(d: $TSFixMe, i: $TSFixMe, adatum: $TSFixMe) {
    const timeIndex = Math.floor(d.arcId / numGroups);
    const series = useRichTooltip
      ? adatum[times[timeIndex]]
          .filter((v: $TSFixMe) => !state.disabled[v.id % numGroups])
          .map((v: $TSFixMe) => ({
            key: v.name,
            value: v.value,
            color: colorFn(v.name, sliceId),
            highlight: v.id === d.arcId,
          }))
      : [
          {
            key: d.name,
            value: d.val,
            color: colorFn(d.name, sliceId),
          },
        ];

    return {
      key: 'Date',
      value: d.time,
      series,
    };
  }

  legend.width(width).color((d: $TSFixMe) => colorFn(d.key, sliceId));
  legendWrap.datum(legendData(datum)).call(legend);

  tooltip.headerFormatter(timeFormat).valueFormatter(format);
  tooltip.classes('tooltip');

  // Compute max radius, which the largest value will occupy
  const roseHeight = height - legend.height();
  const margin = { top: legend.height() };
  const edgeMargin = 35; // space between outermost radius and slice edge
  const maxRadius = Math.min(width, roseHeight) / 2 - edgeMargin;
  const labelThreshold = 0.05;
  const gro = 8; // mouseover radius growth in pixels
  const mini = 0.075;

  const centerTranslate = `translate(${width / 2},${
    roseHeight / 2 + margin.top
  })`;
  const roseWrap = g
    .append('g')
    .attr('transform', centerTranslate)
    .attr('class', 'roseWrap');

  const labelsWrap = g
    .append('g')
    .attr('transform', centerTranslate)
    .attr('class', 'labelsWrap');

  const groupLabelsWrap = g
    .append('g')
    .attr('transform', centerTranslate)
    .attr('class', 'groupLabelsWrap');

  // Compute inner and outer angles for each data point
  function computeArcStates(adatum: $TSFixMe) {
    // Find the max sum of values across all time
    let maxSum = 0;
    let grain = 0;
    const sums = [];
    for (const t of times) {
      const sum = datum[t].reduce(
        (a: $TSFixMe, v: $TSFixMe, i: $TSFixMe) =>
          a + (state.disabled[i] ? 0 : v.value),
        0,
      );
      maxSum = sum > maxSum ? sum : maxSum;
      sums[grain] = sum;
      grain += 1;
    }

    // Compute angle occupied by each time grain
    const dtheta = (Math.PI * 2) / numGrains;
    const angles = [];
    for (let i = 0; i <= numGrains; i += 1) {
      angles.push(dtheta * i - Math.PI / 2);
    }

    // Compute proportion
    const P = maxRadius / maxSum;
    const Q = P * maxRadius;
    const computeOuterRadius = (value: $TSFixMe, innerRadius: $TSFixMe) =>
      useAreaProportions
        ? Math.sqrt(Q * value + innerRadius * innerRadius)
        : P * value + innerRadius;

    const arcSt = {
      data: [],
      extend: {},
      push: {},
      pieStart: {},
      pie: {},
      pieOver: {},
      mini: {},
      labels: [],
      groupLabels: [],
    };
    let arcId = 0;
    for (let i = 0; i < numGrains; i += 1) {
      const t = times[i];
      const startAngle = angles[i];
      const endAngle = angles[i + 1];
      const G = (2 * Math.PI) / sums[i];
      let innerRadius = 0;
      let outerRadius;
      let pieStartAngle = 0;
      let pieEndAngle;
      for (const v of adatum[t]) {
        const val = state.disabled[arcId % numGroups] ? 0 : v.value;
        const { name, time } = v;
        v.id = arcId;
        outerRadius = computeOuterRadius(val, innerRadius);
        arcSt.data.push({
          // @ts-expect-error TS(2322): Type 'number' is not assignable to type 'never'.
          startAngle,
          // @ts-expect-error TS(2322): Type 'number' is not assignable to type 'never'.
          endAngle,
          // @ts-expect-error TS(2322): Type 'number' is not assignable to type 'never'.
          innerRadius,
          // @ts-expect-error TS(2322): Type 'any' is not assignable to type 'never'.
          outerRadius,
          // @ts-expect-error TS(2322): Type 'any' is not assignable to type 'never'.
          name,
          // @ts-expect-error TS(2322): Type 'number' is not assignable to type 'never'.
          arcId,
          // @ts-expect-error TS(2322): Type 'any' is not assignable to type 'never'.
          val,
          // @ts-expect-error TS(2322): Type 'any' is not assignable to type 'never'.
          time,
        });
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        arcSt.extend[arcId] = {
          startAngle,
          endAngle,
          innerRadius,
          name,
          outerRadius: outerRadius + gro,
        };
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        arcSt.push[arcId] = {
          startAngle,
          endAngle,
          innerRadius: innerRadius + gro,
          outerRadius: outerRadius + gro,
        };
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        arcSt.pieStart[arcId] = {
          startAngle,
          endAngle,
          innerRadius: mini * maxRadius,
          outerRadius: maxRadius,
        };
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        arcSt.mini[arcId] = {
          startAngle,
          endAngle,
          innerRadius: innerRadius * mini,
          outerRadius: outerRadius * mini,
        };
        arcId += 1;
        innerRadius = outerRadius;
      }
      // @ts-expect-error TS(2698): Spread types may only be created from object types... Remove this comment to see the full error message
      const labelArc = { ...arcSt.data[i * numGroups] };
      labelArc.outerRadius = maxRadius + 20;
      labelArc.innerRadius = maxRadius + 15;
      // @ts-expect-error TS(2345): Argument of type 'any' is not assignable to parame... Remove this comment to see the full error message
      arcSt.labels.push(labelArc);
      for (const v of adatum[t].concat().sort(sortValues)) {
        const val = state.disabled[v.id % numGroups] ? 0 : v.value;
        pieEndAngle = G * val + pieStartAngle;
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        arcSt.pie[v.id] = {
          startAngle: pieStartAngle,
          endAngle: pieEndAngle,
          innerRadius: maxRadius * mini,
          outerRadius: maxRadius,
          percent: v.value / sums[i],
        };
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        arcSt.pieOver[v.id] = {
          startAngle: pieStartAngle,
          endAngle: pieEndAngle,
          innerRadius: maxRadius * mini,
          outerRadius: maxRadius + gro,
        };
        pieStartAngle = pieEndAngle;
      }
    }
    arcSt.groupLabels = arcSt.data.slice(0, numGroups);

    return arcSt;
  }

  let arcSt = computeArcStates(datum);

  function tween(target: $TSFixMe, resFunc: $TSFixMe) {
    return function doTween(d: $TSFixMe) {
      const interpolate = d3.interpolate(copyArc(d), copyArc(target));

      return (t: $TSFixMe) => resFunc(Object.assign(d, interpolate(t)));
    };
  }

  function arcTween(target: $TSFixMe) {
    return tween(target, (d: $TSFixMe) => arc(d));
  }

  function translateTween(target: $TSFixMe) {
    return tween(target, (d: $TSFixMe) => `translate(${arc.centroid(d)})`);
  }

  // Grab the ID range of segments stand between
  // this segment and the edge of the circle
  const segmentsToEdgeCache = {};
  function getSegmentsToEdge(arcId: $TSFixMe) {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    if (segmentsToEdgeCache[arcId]) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      return segmentsToEdgeCache[arcId];
    }
    const timeIndex = Math.floor(arcId / numGroups);
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    segmentsToEdgeCache[arcId] = [arcId + 1, numGroups * (timeIndex + 1) - 1];

    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    return segmentsToEdgeCache[arcId];
  }

  // Get the IDs of all segments in a timeIndex
  const segmentsInTimeCache = {};
  function getSegmentsInTime(arcId: $TSFixMe) {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    if (segmentsInTimeCache[arcId]) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      return segmentsInTimeCache[arcId];
    }
    const timeIndex = Math.floor(arcId / numGroups);
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    segmentsInTimeCache[arcId] = [
      timeIndex * numGroups,
      (timeIndex + 1) * numGroups - 1,
    ];

    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    return segmentsInTimeCache[arcId];
  }

  let clickId = -1;
  let inTransition = false;
  const ae = roseWrap
    .selectAll('g')
    .data(JSON.parse(JSON.stringify(arcSt.data))) // deep copy data state
    .enter()
    .append('g')
    .attr('class', 'segment')
    .classed('clickable', true)
    .on('mouseover', mouseover)
    .on('mouseout', mouseout)
    .on('mousemove', mousemove)
    .on('click', click);

  const labels = labelsWrap
    .selectAll('g')
    .data(JSON.parse(JSON.stringify(arcSt.labels)))
    .enter()
    .append('g')
    .attr('class', 'roseLabel')
    .attr('transform', (d: $TSFixMe) => `translate(${arc.centroid(d)})`);

  labels
    .append('text')
    .style('text-anchor', 'middle')
    .style('fill', '#000')
    .text((d: $TSFixMe) => timeFormat(d.time));

  const groupLabels = groupLabelsWrap
    .selectAll('g')
    .data(JSON.parse(JSON.stringify(arcSt.groupLabels)))
    .enter()
    .append('g');

  groupLabels
    .style('opacity', 0)
    .attr('class', 'roseGroupLabels')
    .append('text')
    .style('text-anchor', 'middle')
    .style('fill', '#000')
    .text((d: $TSFixMe) => d.name);

  const arcs = ae
    .append('path')
    .attr('class', 'arc')
    .attr('fill', (d: $TSFixMe) => colorFn(d.name, sliceId))
    .attr('d', arc);

  function mousemove() {
    tooltip();
  }

  function mouseover(this: $TSFixMe, b: $TSFixMe, i: $TSFixMe) {
    tooltip.data(tooltipData(b, i, datum)).hidden(false);
    const $this = d3.select(this);
    $this.classed('hover', true);
    if (clickId < 0 && !inTransition) {
      $this
        .select('path')
        .interrupt()
        .transition()
        .duration(180)
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        .attrTween('d', arcTween(arcSt.extend[i]));
      const edge = getSegmentsToEdge(i);
      arcs
        .filter((d: $TSFixMe) => edge[0] <= d.arcId && d.arcId <= edge[1])
        .interrupt()
        .transition()
        .duration(180)
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        .attrTween('d', (d: $TSFixMe) => arcTween(arcSt.push[d.arcId])(d));
    } else if (!inTransition) {
      const segments = getSegmentsInTime(clickId);
      if (segments[0] <= b.arcId && b.arcId <= segments[1]) {
        $this
          .select('path')
          .interrupt()
          .transition()
          .duration(180)
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          .attrTween('d', arcTween(arcSt.pieOver[i]));
      }
    }
  }

  function mouseout(this: $TSFixMe, b: $TSFixMe, i: $TSFixMe) {
    tooltip.hidden(true);
    const $this = d3.select(this);
    $this.classed('hover', false);
    if (clickId < 0 && !inTransition) {
      $this
        .select('path')
        .interrupt()
        .transition()
        .duration(180)
        .attrTween('d', arcTween(arcSt.data[i]));
      const edge = getSegmentsToEdge(i);
      arcs
        .filter((d: $TSFixMe) => edge[0] <= d.arcId && d.arcId <= edge[1])
        .interrupt()
        .transition()
        .duration(180)
        .attrTween('d', (d: $TSFixMe) => arcTween(arcSt.data[d.arcId])(d));
    } else if (!inTransition) {
      const segments = getSegmentsInTime(clickId);
      if (segments[0] <= b.arcId && b.arcId <= segments[1]) {
        $this
          .select('path')
          .interrupt()
          .transition()
          .duration(180)
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          .attrTween('d', arcTween(arcSt.pie[i]));
      }
    }
  }

  function click(b: $TSFixMe, i: $TSFixMe) {
    if (inTransition) {
      return;
    }
    const delay = d3.event.altKey ? 3750 : 375;
    const segments = getSegmentsInTime(i);
    if (clickId < 0) {
      inTransition = true;
      clickId = i;
      labels
        .interrupt()
        .transition()
        .duration(delay)
        .attrTween('transform', (d: $TSFixMe) =>
          translateTween({
            outerRadius: 0,
            innerRadius: 0,
            startAngle: d.startAngle,
            endAngle: d.endAngle,
          })(d),
        )
        .style('opacity', 0);
      groupLabels
        .attr(
          'transform',
          `translate(${arc.centroid({
            outerRadius: maxRadius + 20,
            innerRadius: maxRadius + 15,
            // @ts-expect-error TS(2339): Property 'startAngle' does not exist on type 'neve... Remove this comment to see the full error message
            startAngle: arcSt.data[i].startAngle,
            // @ts-expect-error TS(2339): Property 'endAngle' does not exist on type 'never'... Remove this comment to see the full error message
            endAngle: arcSt.data[i].endAngle,
          })})`,
        )
        .interrupt()
        .transition()
        .delay(delay)
        .duration(delay)
        .attrTween('transform', (d: $TSFixMe) =>
          translateTween({
            outerRadius: maxRadius + 20,
            innerRadius: maxRadius + 15,
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            startAngle: arcSt.pie[segments[0] + d.arcId].startAngle,
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            endAngle: arcSt.pie[segments[0] + d.arcId].endAngle,
          })(d),
        )
        .style('opacity', (d: $TSFixMe) =>
          state.disabled[d.arcId] ||
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          arcSt.pie[segments[0] + d.arcId].percent < labelThreshold
            ? 0
            : 1,
        );
      ae.classed(
        'clickable',
        (d: $TSFixMe) => segments[0] > d.arcId || d.arcId > segments[1],
      );
      arcs
        .filter(
          (d: $TSFixMe) => segments[0] <= d.arcId && d.arcId <= segments[1],
        )
        .interrupt()
        .transition()
        .duration(delay)
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        .attrTween('d', (d: $TSFixMe) => arcTween(arcSt.pieStart[d.arcId])(d))
        .transition()
        .duration(delay)
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        .attrTween('d', (d: $TSFixMe) => arcTween(arcSt.pie[d.arcId])(d))
        .each('end', () => {
          inTransition = false;
        });
      arcs
        .filter((d: $TSFixMe) => segments[0] > d.arcId || d.arcId > segments[1])
        .interrupt()
        .transition()
        .duration(delay)
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        .attrTween('d', (d: $TSFixMe) => arcTween(arcSt.mini[d.arcId])(d));
    } else if (clickId < segments[0] || segments[1] < clickId) {
      inTransition = true;
      const clickSegments = getSegmentsInTime(clickId);
      labels
        .interrupt()
        .transition()
        .delay(delay)
        .duration(delay)
        .attrTween('transform', (d: $TSFixMe) =>
          translateTween(arcSt.labels[d.arcId / numGroups])(d),
        )
        .style('opacity', 1);
      groupLabels
        .interrupt()
        .transition()
        .duration(delay)
        .attrTween(
          'transform',
          translateTween({
            outerRadius: maxRadius + 20,
            innerRadius: maxRadius + 15,
            // @ts-expect-error TS(2339): Property 'startAngle' does not exist on type 'neve... Remove this comment to see the full error message
            startAngle: arcSt.data[clickId].startAngle,
            // @ts-expect-error TS(2339): Property 'endAngle' does not exist on type 'never'... Remove this comment to see the full error message
            endAngle: arcSt.data[clickId].endAngle,
          }),
        )
        .style('opacity', 0);
      ae.classed('clickable', true);
      arcs
        .filter(
          (d: $TSFixMe) =>
            clickSegments[0] <= d.arcId && d.arcId <= clickSegments[1],
        )
        .interrupt()
        .transition()
        .duration(delay)
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        .attrTween('d', (d: $TSFixMe) => arcTween(arcSt.pieStart[d.arcId])(d))
        .transition()
        .duration(delay)
        .attrTween('d', (d: $TSFixMe) => arcTween(arcSt.data[d.arcId])(d))
        .each('end', () => {
          clickId = -1;
          inTransition = false;
        });
      arcs
        .filter(
          (d: $TSFixMe) =>
            clickSegments[0] > d.arcId || d.arcId > clickSegments[1],
        )
        .interrupt()
        .transition()
        .delay(delay)
        .duration(delay)
        .attrTween('d', (d: $TSFixMe) => arcTween(arcSt.data[d.arcId])(d));
    }
  }

  function updateActive() {
    const delay = d3.event.altKey ? 3000 : 300;
    legendWrap.datum(legendData(datum)).call(legend);
    const nArcSt = computeArcStates(datum);
    inTransition = true;
    if (clickId < 0) {
      arcs
        .style('opacity', 1)
        .interrupt()
        .transition()
        .duration(delay)
        .attrTween('d', (d: $TSFixMe) => arcTween(nArcSt.data[d.arcId])(d))
        .each('end', () => {
          inTransition = false;
          arcSt = nArcSt;
        })
        .transition()
        .duration(0)
        .style('opacity', (d: $TSFixMe) =>
          state.disabled[d.arcId % numGroups] ? 0 : 1,
        );
    } else {
      const segments = getSegmentsInTime(clickId);
      arcs
        .style('opacity', 1)
        .interrupt()
        .transition()
        .duration(delay)
        .attrTween('d', (d: $TSFixMe) =>
          segments[0] <= d.arcId && d.arcId <= segments[1]
            ? // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              arcTween(nArcSt.pie[d.arcId])(d)
            : // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              arcTween(nArcSt.mini[d.arcId])(d),
        )
        .each('end', () => {
          inTransition = false;
          arcSt = nArcSt;
        })
        .transition()
        .duration(0)
        .style('opacity', (d: $TSFixMe) =>
          state.disabled[d.arcId % numGroups] ? 0 : 1,
        );
      groupLabels
        .interrupt()
        .transition()
        .duration(delay)
        .attrTween('transform', (d: $TSFixMe) =>
          translateTween({
            outerRadius: maxRadius + 20,
            innerRadius: maxRadius + 15,
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            startAngle: nArcSt.pie[segments[0] + d.arcId].startAngle,
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            endAngle: nArcSt.pie[segments[0] + d.arcId].endAngle,
          })(d),
        )
        .style('opacity', (d: $TSFixMe) =>
          state.disabled[d.arcId] ||
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          arcSt.pie[segments[0] + d.arcId].percent < labelThreshold
            ? 0
            : 1,
        );
    }
  }

  legend.dispatch.on('stateChange', (newState: $TSFixMe) => {
    if (state.disabled !== newState.disabled) {
      state.disabled = newState.disabled;
      updateActive();
    }
  });
}

Rose.displayName = 'Rose';
Rose.propTypes = propTypes;

export default Rose;
