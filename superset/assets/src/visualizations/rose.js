/* eslint no-use-before-define: ["error", { "functions": false }] */
import d3 from 'd3';
import nv from 'nvd3';
import { d3TimeFormatPreset } from '../modules/utils';
import { getColorFromScheme } from '../modules/colors';

import './rose.css';

function copyArc(d) {
  return {
    startAngle: d.startAngle,
    endAngle: d.endAngle,
    innerRadius: d.innerRadius,
    outerRadius: d.outerRadius,
  };
}

function sortValues(a, b) {
  if (a.value === b.value) {
    return a.name > b.name ? 1 : -1;
  }
  return b.value - a.value;
}

function roseVis(slice, payload) {
  const data = payload.data;
  const fd = slice.formData;
  const div = d3.select(slice.selector);

  const datum = data;
  const times = Object.keys(datum)
    .map(t => parseInt(t, 10))
    .sort((a, b) => a - b);
  const numGrains = times.length;
  const numGroups = datum[times[0]].length;
  const format = d3.format(fd.number_format);
  const timeFormat = d3TimeFormatPreset(fd.date_time_format);

  d3.select('.nvtooltip').remove();
  div.selectAll('*').remove();

  const arc = d3.svg.arc();
  const legend = nv.models.legend();
  const tooltip = nv.models.tooltip();
  const state = { disabled: datum[times[0]].map(() => false) };
  const color = name => getColorFromScheme(name, fd.color_scheme);

  const svg = div
    .append('svg')
    .attr('width', slice.width())
    .attr('height', slice.height());

  const g = svg
    .append('g')
    .attr('class', 'rose')
    .append('g');

  const legendWrap = g
    .append('g')
    .attr('class', 'legendWrap');

  function legendData(adatum) {
    return adatum[times[0]].map((v, i) => ({
      disabled: state.disabled[i],
      key: v.name,
    }));
  }

  function tooltipData(d, i, adatum) {
    const timeIndex = Math.floor(d.arcId / numGroups);
    const series = fd.rich_tooltip ?
      adatum[times[timeIndex]]
        .filter(v => !state.disabled[v.id % numGroups])
        .map(v => ({
          key: v.name,
          value: v.value,
          color: color(v.name),
          highlight: v.id === d.arcId,
        })) : [{ key: d.name, value: d.val, color: color(d.name) }];
    return {
      key: 'Date',
      value: d.time,
      series,
    };
  }

  legend
    .width(slice.width())
    .color(d => getColorFromScheme(d.key, fd.color_scheme));
  legendWrap
    .datum(legendData(datum))
    .call(legend);

  tooltip
    .headerFormatter(timeFormat)
    .valueFormatter(format);

  // Compute max radius, which the largest value will occupy
  const width = slice.width();
  const height = slice.height() - legend.height();
  const margin = { top: legend.height() };
  const edgeMargin = 35; // space between outermost radius and slice edge
  const maxRadius = Math.min(width, height) / 2 - edgeMargin;
  const labelThreshold = 0.05;
  const gro = 8; // mouseover radius growth in pixels
  const mini = 0.075;

  const centerTranslate = `translate(${width / 2},${height / 2 + margin.top})`;
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
  function computeArcStates(adatum) {
    // Find the max sum of values across all time
    let maxSum = 0;
    let grain = 0;
    const sums = [];
    for (const t of times) {
      const sum = datum[t].reduce((a, v, i) =>
        a + (state.disabled[i] ? 0 : v.value), 0,
      );
      maxSum = sum > maxSum ? sum : maxSum;
      sums[grain] = sum;
      grain++;
    }

    // Compute angle occupied by each time grain
    const dtheta = Math.PI * 2 / numGrains;
    const angles = [];
    for (let i = 0; i <= numGrains; i++) {
      angles.push(dtheta * i - Math.PI / 2);
    }

    // Compute proportion
    const P = maxRadius / maxSum;
    const Q = P * maxRadius;
    const computeOuterRadius = (value, innerRadius) => fd.rose_area_proportion ?
      Math.sqrt(Q * value + innerRadius * innerRadius) :
      P * value + innerRadius;

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
    for (let i = 0; i < numGrains; i++) {
      const t = times[i];
      const startAngle = angles[i];
      const endAngle = angles[i + 1];
      const G = 2 * Math.PI / sums[i];
      let innerRadius = 0;
      let outerRadius;
      let pieStartAngle = 0;
      let pieEndAngle;
      for (const v of adatum[t]) {
        const val = state.disabled[arcId % numGroups] ? 0 : v.value;
        const name = v.name;
        const time = v.time;
        v.id = arcId;
        outerRadius = computeOuterRadius(val, innerRadius);
        arcSt.data.push({ startAngle, endAngle, innerRadius, outerRadius, name, arcId, val, time });
        arcSt.extend[arcId] = {
          startAngle, endAngle, innerRadius, name, outerRadius: outerRadius + gro,
        };
        arcSt.push[arcId] = {
          startAngle, endAngle, innerRadius: innerRadius + gro, outerRadius: outerRadius + gro,
        };
        arcSt.pieStart[arcId] = {
          startAngle, endAngle, innerRadius: mini * maxRadius, outerRadius: maxRadius,
        };
        arcSt.mini[arcId] = {
          startAngle, endAngle, innerRadius: innerRadius * mini, outerRadius: outerRadius * mini,
        };
        arcId++;
        innerRadius = outerRadius;
      }
      const labelArc = Object.assign({}, arcSt.data[i * numGroups]);
      labelArc.outerRadius = maxRadius + 20;
      labelArc.innerRadius = maxRadius + 15;
      arcSt.labels.push(labelArc);
      for (const v of adatum[t].concat().sort(sortValues)) {
        const val = state.disabled[v.id % numGroups] ? 0 : v.value;
        pieEndAngle = G * val + pieStartAngle;
        arcSt.pie[v.id] = {
          startAngle: pieStartAngle,
          endAngle: pieEndAngle,
          innerRadius: maxRadius * mini,
          outerRadius: maxRadius,
          percent: v.value / sums[i],
        };
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

  function tween(target, resFunc) {
    return function (d) {
      const interpolate = d3.interpolate(copyArc(d), copyArc(target));
      return t => resFunc(Object.assign(d, interpolate(t)));
    };
  }

  function arcTween(target) {
    return tween(target, d => arc(d));
  }

  function translateTween(target) {
    return tween(target, d => `translate(${arc.centroid(d)})`);
  }

  // Grab the ID range of segments stand between
  // this segment and the edge of the circle
  const segmentsToEdgeCache = {};
  function getSegmentsToEdge(arcId) {
    if (segmentsToEdgeCache[arcId]) {
      return segmentsToEdgeCache[arcId];
    }
    const timeIndex = Math.floor(arcId / numGroups);
    segmentsToEdgeCache[arcId] = [arcId + 1, numGroups * (timeIndex + 1) - 1];
    return segmentsToEdgeCache[arcId];
  }

  // Get the IDs of all segments in a timeIndex
  const segmentsInTimeCache = {};
  function getSegmentsInTime(arcId) {
    if (segmentsInTimeCache[arcId]) {
      return segmentsInTimeCache[arcId];
    }
    const timeIndex = Math.floor(arcId / numGroups);
    segmentsInTimeCache[arcId] = [timeIndex * numGroups, (timeIndex + 1) * numGroups - 1];
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
    .attr('transform', d => `translate(${arc.centroid(d)})`);

  labels
    .append('text')
    .style('text-anchor', 'middle')
    .style('fill', '#000')
    .text(d => timeFormat(d.time));

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
    .text(d => d.name);

  const arcs = ae
    .append('path')
    .attr('class', 'arc')
    .attr('fill', d => color(d.name))
    .attr('d', arc);

  function mousemove() {
    tooltip();
  }

  function mouseover(b, i) {
    tooltip.data(tooltipData(b, i, datum)).hidden(false);
    const $this = d3.select(this);
    $this.classed('hover', true);
    if (clickId < 0 && !inTransition) {
      $this
        .select('path')
        .interrupt()
        .transition()
        .duration(180)
        .attrTween('d', arcTween(arcSt.extend[i]));
      const edge = getSegmentsToEdge(i);
      arcs
        .filter(d => edge[0] <= d.arcId && d.arcId <= edge[1])
        .interrupt()
        .transition()
        .duration(180)
        .attrTween('d', d => arcTween(arcSt.push[d.arcId])(d));
    } else if (!inTransition) {
      const segments = getSegmentsInTime(clickId);
      if (segments[0] <= b.arcId && b.arcId <= segments[1]) {
        $this
          .select('path')
          .interrupt()
          .transition()
          .duration(180)
          .attrTween('d', arcTween(arcSt.pieOver[i]));
      }
    }
  }

  function mouseout(b, i) {
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
        .filter(d => edge[0] <= d.arcId && d.arcId <= edge[1])
        .interrupt()
        .transition()
        .duration(180)
        .attrTween('d', d => arcTween(arcSt.data[d.arcId])(d));
    } else if (!inTransition) {
      const segments = getSegmentsInTime(clickId);
      if (segments[0] <= b.arcId && b.arcId <= segments[1]) {
        $this
          .select('path')
          .interrupt()
          .transition()
          .duration(180)
          .attrTween('d', arcTween(arcSt.pie[i]));
      }
    }
  }

  function click(b, i) {
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
        .attrTween('transform', d => translateTween({
          outerRadius: 0,
          innerRadius: 0,
          startAngle: d.startAngle,
          endAngle: d.endAngle,
        })(d))
        .style('opacity', 0);
      groupLabels
        .attr('transform', `translate(${arc.centroid({
          outerRadius: maxRadius + 20,
          innerRadius: maxRadius + 15,
          startAngle: arcSt.data[i].startAngle,
          endAngle: arcSt.data[i].endAngle,
        })})`)
        .interrupt()
        .transition()
        .delay(delay)
        .duration(delay)
        .attrTween('transform', d => translateTween({
          outerRadius: maxRadius + 20,
          innerRadius: maxRadius + 15,
          startAngle: arcSt.pie[segments[0] + d.arcId].startAngle,
          endAngle: arcSt.pie[segments[0] + d.arcId].endAngle,
        })(d))
        .style('opacity', d =>
          state.disabled[d.arcId] || arcSt.pie[segments[0] + d.arcId].percent < labelThreshold ?
          0 : 1);
      ae.classed('clickable', d => segments[0] > d.arcId || d.arcId > segments[1]);
      arcs
        .filter(d => segments[0] <= d.arcId && d.arcId <= segments[1])
        .interrupt()
        .transition()
        .duration(delay)
        .attrTween('d', d => arcTween(arcSt.pieStart[d.arcId])(d))
        .transition()
        .duration(delay)
        .attrTween('d', d => arcTween(arcSt.pie[d.arcId])(d))
        .each('end', () => { inTransition = false; });
      arcs
        .filter(d => segments[0] > d.arcId || d.arcId > segments[1])
        .interrupt()
        .transition()
        .duration(delay)
        .attrTween('d', d => arcTween(arcSt.mini[d.arcId])(d));
    } else if (clickId < segments[0] || segments[1] < clickId) {
      inTransition = true;
      const clickSegments = getSegmentsInTime(clickId);
      labels
        .interrupt()
        .transition()
        .delay(delay)
        .duration(delay)
        .attrTween('transform', d => translateTween(arcSt.labels[d.arcId / numGroups])(d))
        .style('opacity', 1);
      groupLabels
        .interrupt()
        .transition()
        .duration(delay)
        .attrTween('transform', translateTween({
          outerRadius: maxRadius + 20,
          innerRadius: maxRadius + 15,
          startAngle: arcSt.data[clickId].startAngle,
          endAngle: arcSt.data[clickId].endAngle,
        }))
        .style('opacity', 0);
      ae.classed('clickable', true);
      arcs
        .filter(d => clickSegments[0] <= d.arcId && d.arcId <= clickSegments[1])
        .interrupt()
        .transition()
        .duration(delay)
        .attrTween('d', d => arcTween(arcSt.pieStart[d.arcId])(d))
        .transition()
        .duration(delay)
        .attrTween('d', d => arcTween(arcSt.data[d.arcId])(d))
        .each('end', () => { clickId = -1; inTransition = false; });
      arcs
        .filter(d => clickSegments[0] > d.arcId || d.arcId > clickSegments[1])
        .interrupt()
        .transition()
        .delay(delay)
        .duration(delay)
        .attrTween('d', d => arcTween(arcSt.data[d.arcId])(d));
    }
  }

  function updateActive() {
    const delay = d3.event.altKey ? 3000 : 300;
    legendWrap
      .datum(legendData(datum))
      .call(legend);
    const nArcSt = computeArcStates(datum);
    inTransition = true;
    if (clickId < 0) {
      arcs
        .style('opacity', 1)
        .interrupt()
        .transition()
        .duration(delay)
        .attrTween('d', d => arcTween(nArcSt.data[d.arcId])(d))
        .each('end', () => {
          inTransition = false;
          arcSt = nArcSt;
        })
        .transition()
        .duration(0)
        .style('opacity', d => state.disabled[d.arcId % numGroups] ? 0 : 1);
    } else {
      const segments = getSegmentsInTime(clickId);
      arcs
        .style('opacity', 1)
        .interrupt()
        .transition()
        .duration(delay)
        .attrTween('d', d => segments[0] <= d.arcId && d.arcId <= segments[1] ?
          arcTween(nArcSt.pie[d.arcId])(d) :
          arcTween(nArcSt.mini[d.arcId])(d),
        )
        .each('end', () => {
          inTransition = false;
          arcSt = nArcSt;
        })
        .transition()
        .duration(0)
        .style('opacity', d => state.disabled[d.arcId % numGroups] ? 0 : 1);
      groupLabels
        .interrupt()
        .transition()
        .duration(delay)
        .attrTween('transform', d => translateTween({
          outerRadius: maxRadius + 20,
          innerRadius: maxRadius + 15,
          startAngle: nArcSt.pie[segments[0] + d.arcId].startAngle,
          endAngle: nArcSt.pie[segments[0] + d.arcId].endAngle,
        })(d))
        .style('opacity', d =>
          state.disabled[d.arcId] ||
          (arcSt.pie[segments[0] + d.arcId].percent < labelThreshold)
          ? 0 : 1);
    }
  }

  legend.dispatch.on('stateChange', function (newState) {
    if (state.disabled !== newState.disabled) {
      state.disabled = newState.disabled;
      updateActive();
    }
  });
}

module.exports = roseVis;
