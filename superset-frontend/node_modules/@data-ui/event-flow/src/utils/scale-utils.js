import { scalePoint, scaleOrdinal, scaleLinear } from '@vx/scale';

import { extent as d3Extent } from 'd3-array';
import { format } from 'd3-format';

import {
  ENTITY_ID,
  EVENT_COUNT,
  EVENT_NAME,
  ELAPSED_MS,
  ELAPSED_MS_ROOT,
  ELAPSED_TIME_SCALE,
  EVENT_SEQUENCE_SCALE,
  EVENT_COUNT_SCALE,
  FILTERED_EVENTS,
  NODE_SEQUENCE_SCALE,
  NODE_COLOR_SCALE,
  ORDER_BY_EVENT_COUNT,
  ORDER_BY_ELAPSED_MS,
} from '../constants';

import { colors } from '../theme';

export function computeElapsedTimeScale(nodesArray, width) {
  const domain = d3Extent(nodesArray, n => n[ELAPSED_MS_ROOT]);

  return scaleLinear({
    nice: true,
    clamp: true,
    range: [0, width],
    domain,
  });
}

export function computeEventCountScale(root, height) {
  // The maximum event count should be the sum of events at the root node
  // @todo: correct for filter nodes
  const max = Object.keys(root.children).reduce(
    (result, curr) => result + root.children[curr][EVENT_COUNT],
    0,
  );

  return scaleLinear({
    nice: true,
    clamp: true,
    range: [0, height],
    domain: [0, max],
  });
}

export function computeEventSequenceScale(nodesArray, width) {
  const domain = d3Extent(nodesArray, n => n.depth);

  return scaleLinear({
    nice: true,
    clamp: true,
    range: [0, width],
    domain,
  });
}

function recursivelyDivideHeight(nodes, height, lookup) {
  if (nodes) {
    const leftNodes = [];
    const rightNodes = [];
    Object.values(nodes).forEach(n => {
      if (n.depth >= 0) rightNodes.push(n);
      if (n.depth < 0) leftNodes.push(n);
    });

    const rightHeight = height / rightNodes.length;
    const leftHeight = height / leftNodes.length;

    leftNodes.forEach(n => {
      lookup[n.id] = leftHeight; // eslint-disable-line no-param-reassign
      recursivelyDivideHeight(n.children, leftHeight, lookup);
    });

    rightNodes.forEach(n => {
      lookup[n.id] = rightHeight; // eslint-disable-line no-param-reassign
      recursivelyDivideHeight(n.children, rightHeight, lookup);
    });
  }
}

export function computeNodeSequenceScale(root, height) {
  /*
   * the goal here is to distribute the nodes at every depth evenly across height
   * the height of a node with a given depth should therefore be the same, taking into
   * account the height of all parent nodes
   */
  const idToHeight = {};
  recursivelyDivideHeight(root.children, height, idToHeight);

  function scale(id) {
    return idToHeight[id];
  }

  // mock these out to make other dependencies happy
  scale.range = () => [0, height];
  scale.domain = () => [0, 0];
  scale.copy = () => scale;

  return scale;
}

export function computeColorScale(array, accessor = d => d.name || d[EVENT_NAME]) {
  const names = {};
  array.forEach(d => {
    const key = accessor(d);
    if (key) {
      names[key] = true;
    }
  });
  // sort to make color assignment deterministic
  const sortedNames = Object.keys(names).sort();
  if (sortedNames.length > colors.categories.length) {
    console.warn(
      `Unique color values ${sortedNames.length} exceeds the number of unique colors
      (${colors.categories.length}). Consider filtering event types.`,
    );
  }

  return scaleOrdinal({
    range: [`url(#${FILTERED_EVENTS})`, ...colors.categories],
    domain: [FILTERED_EVENTS, ...sortedNames],
  });
}

export function numTicksForHeight(height) {
  if (height <= 300) return 3;
  if (height <= 600) return 5;

  return 6;
}

export function numTicksForWidth(width) {
  if (width <= 300) return 3;
  if (width <= 400) return 5;

  return 6;
}

export const zeroDecimals = format(',.0f');
export const oneDecimal = format(',.1f');
export const twoDecimals = format(',.2f');

const second = 1000;
const minute = second * 60;
const hour = minute * 60;
const day = hour * 24;

export function timeUnitFromTimeExtent(extent) {
  const maxMs = Math.max(...extent.map(Math.abs));
  if (maxMs / day >= 3) return 'day';
  if (maxMs / hour >= 3) return 'hour';
  if (maxMs / minute >= 3) return 'minute';

  return 'second';
}

export function formatInterval(ms, optionalUnit) {
  const num = typeof ms === 'string' ? parseInt(ms, 10) : ms;
  let unit = optionalUnit;
  if (!unit) unit = timeUnitFromTimeExtent([num]);
  switch (unit) {
    case 'second':
      return `${zeroDecimals(num / second)}sec`;
    case 'minute':
      return `${zeroDecimals(num / minute)}min`;
    case 'hour':
      return `${oneDecimal(num / hour)}hr`;
    case 'day':
      return `${oneDecimal(num / day)}d`;
    default:
      return zeroDecimals(num);
  }
}

/*
 * returns a time formatter which tries to set an appropriate unit
 * based on the extent of the passed scale
 */
export function getTimeFormatter(scale) {
  const unit = timeUnitFromTimeExtent(scale.domain());

  return ms => formatInterval(ms, unit);
}

export const nodeSorters = {
  [ORDER_BY_EVENT_COUNT]: (a, b) => b[EVENT_COUNT] - a[EVENT_COUNT], // high to low
  [ORDER_BY_ELAPSED_MS]: (a, b) => {
    const delta = a[ELAPSED_MS] - b[ELAPSED_MS];

    return a.depth >= 0 ? delta : -delta; // low to high
  },
};

export function buildAllScales(graph, width, height) {
  if (!graph || !graph.nodes || !width || !height) return {};

  const nodesArray = Object.keys(graph.nodes).map(k => graph.nodes[k]);
  const timeScale = computeElapsedTimeScale(nodesArray, width);

  return {
    [ELAPSED_TIME_SCALE]: {
      scale: timeScale,
      accessor: n => n[ELAPSED_MS_ROOT],
      label: 'Elapsed time',
      format: getTimeFormatter(timeScale),
      isTimeScale: true,
    },

    [EVENT_SEQUENCE_SCALE]: {
      scale: computeEventSequenceScale(nodesArray, width),
      accessor: n => n.depth,
      label: 'Event number',
    },

    [EVENT_COUNT_SCALE]: {
      scale: computeEventCountScale(graph.root, height),
      accessor: n => n[EVENT_COUNT],
      label: '# Events',
    },

    [NODE_SEQUENCE_SCALE]: {
      scale: computeNodeSequenceScale(graph.root, height),
      accessor: n => n.id,
      label: 'Node sequence',
    },

    [NODE_COLOR_SCALE]: {
      scale: computeColorScale(nodesArray),
      accessor: n => n.name || n[EVENT_NAME],
      label: 'Event name',
    },
  };
}

export function computeEntityNameScale(sequences, heightPerEntity = 30) {
  const domain = sequences.map(sequence => sequence[0] && sequence[0][ENTITY_ID]);
  const height = sequences.length * heightPerEntity;

  const scale = scalePoint({
    clamp: true,
    range: [0, height],
    padding: 0.2,
    domain,
  });

  return {
    scale,
    accessor: d => d[ENTITY_ID],
    label: 'Entity id',
  };
}

export function computeTimeScaleForSequences(sequences, width) {
  let domain = null;
  sequences.forEach(sequence => {
    const [min, max] = d3Extent(sequence, n => n[ELAPSED_MS_ROOT]);
    if (!domain) domain = [min, max];
    domain[0] = Math.min(min, domain[0]);
    domain[1] = Math.max(max, domain[1]);
  });

  const scale = scaleLinear({
    nice: true,
    clamp: true,
    range: [0, width],
    domain,
  });

  return {
    scale,
    accessor: d => d[ELAPSED_MS_ROOT],
    label: 'Elapsed time',
    format: getTimeFormatter(scale),
  };
}
