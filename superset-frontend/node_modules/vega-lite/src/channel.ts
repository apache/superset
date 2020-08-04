/*
 * Constants and utilities for encoding channels (Visual variables)
 * such as 'x', 'y', 'color'.
 */

import {RangeType} from './compile/scale/type';
import {Encoding} from './encoding';
import {Mark} from './mark';
import {EncodingFacetMapping, EncodingFacetMapping as ExtendedFacetMapping} from './spec/facet';
import {Flag, keys} from './util';

export type Channel = keyof Encoding<any> | keyof ExtendedFacetMapping<any>;

// Facet
export const ROW: 'row' = 'row';
export const COLUMN: 'column' = 'column';

export const FACET: 'facet' = 'facet';

// Position
export const X: 'x' = 'x';
export const Y: 'y' = 'y';
export const X2: 'x2' = 'x2';
export const Y2: 'y2' = 'y2';

// Geo Position
export const LATITUDE: 'latitude' = 'latitude';
export const LONGITUDE: 'longitude' = 'longitude';
export const LATITUDE2: 'latitude2' = 'latitude2';
export const LONGITUDE2: 'longitude2' = 'longitude2';

// Mark property with scale
export const COLOR: 'color' = 'color';

export const FILL: 'fill' = 'fill';

export const STROKE: 'stroke' = 'stroke';

export const SHAPE: 'shape' = 'shape';
export const SIZE: 'size' = 'size';
export const OPACITY: 'opacity' = 'opacity';
export const FILLOPACITY: 'fillOpacity' = 'fillOpacity';

export const STROKEOPACITY: 'strokeOpacity' = 'strokeOpacity';

export const STROKEWIDTH: 'strokeWidth' = 'strokeWidth';

// Non-scale channel
export const TEXT: 'text' = 'text';
export const ORDER: 'order' = 'order';
export const DETAIL: 'detail' = 'detail';
export const KEY: 'key' = 'key';

export const TOOLTIP: 'tooltip' = 'tooltip';
export const HREF: 'href' = 'href';

export const URL: 'url' = 'url';

export type PositionChannel = 'x' | 'y' | 'x2' | 'y2';

const POSITION_CHANNEL_INDEX: Flag<PositionChannel> = {
  x: 1,
  y: 1,
  x2: 1,
  y2: 1
};
export function isPositionChannel(c: Channel): c is PositionChannel {
  return c in POSITION_CHANNEL_INDEX;
}

export type GeoPositionChannel = 'longitude' | 'latitude' | 'longitude2' | 'latitude2';

export function getPositionChannelFromLatLong(channel: GeoPositionChannel): PositionChannel {
  switch (channel) {
    case LATITUDE:
      return 'y';
    case LATITUDE2:
      return 'y2';
    case LONGITUDE:
      return 'x';
    case LONGITUDE2:
      return 'x2';
  }
}

const GEOPOSITION_CHANNEL_INDEX: Flag<GeoPositionChannel> = {
  longitude: 1,
  longitude2: 1,
  latitude: 1,
  latitude2: 1
};

export function isGeoPositionChannel(c: Channel): c is GeoPositionChannel {
  return c in GEOPOSITION_CHANNEL_INDEX;
}

export const GEOPOSITION_CHANNELS = keys(GEOPOSITION_CHANNEL_INDEX);

const UNIT_CHANNEL_INDEX: Flag<keyof Encoding<any>> = {
  ...POSITION_CHANNEL_INDEX,

  ...GEOPOSITION_CHANNEL_INDEX,

  // color
  color: 1,
  fill: 1,
  stroke: 1,

  // other non-position with scale
  opacity: 1,
  fillOpacity: 1,
  strokeOpacity: 1,

  strokeWidth: 1,
  size: 1,
  shape: 1,

  // channels without scales
  order: 1,
  text: 1,
  detail: 1,
  key: 1,
  tooltip: 1,
  href: 1,
  url: 1
};

export type ColorChannel = 'color' | 'fill' | 'stroke';

export function isColorChannel(channel: Channel): channel is ColorChannel {
  return channel === 'color' || channel === 'fill' || channel === 'stroke';
}

export type FacetChannel = keyof EncodingFacetMapping<any>;

const FACET_CHANNEL_INDEX: Flag<keyof EncodingFacetMapping<any>> = {
  row: 1,
  column: 1,
  facet: 1
};

export const FACET_CHANNELS = keys(FACET_CHANNEL_INDEX);

const CHANNEL_INDEX = {
  ...UNIT_CHANNEL_INDEX,
  ...FACET_CHANNEL_INDEX
};

export const CHANNELS = keys(CHANNEL_INDEX);

const {order: _o, detail: _d, tooltip: _tt1, ...SINGLE_DEF_CHANNEL_INDEX} = CHANNEL_INDEX;
const {row: _r, column: _c, facet: _f, ...SINGLE_DEF_UNIT_CHANNEL_INDEX} = SINGLE_DEF_CHANNEL_INDEX;
/**
 * Channels that cannot have an array of channelDef.
 * model.fieldDef, getFieldDef only work for these channels.
 *
 * (The only two channels that can have an array of channelDefs are "detail" and "order".
 * Since there can be multiple fieldDefs for detail and order, getFieldDef/model.fieldDef
 * are not applicable for them. Similarly, selection projection won't work with "detail" and "order".)
 */

export const SINGLE_DEF_CHANNELS = keys(SINGLE_DEF_CHANNEL_INDEX);

export type SingleDefChannel = typeof SINGLE_DEF_CHANNELS[number];

export const SINGLE_DEF_UNIT_CHANNELS = keys(SINGLE_DEF_UNIT_CHANNEL_INDEX);

export type SingleDefUnitChannel = typeof SINGLE_DEF_UNIT_CHANNELS[number];

export function isSingleDefUnitChannel(str: string): str is SingleDefUnitChannel {
  return !!SINGLE_DEF_UNIT_CHANNEL_INDEX[str];
}

export function isChannel(str: string): str is Channel {
  return !!CHANNEL_INDEX[str];
}

export type SecondaryRangeChannel = 'x2' | 'y2' | 'latitude2' | 'longitude2';

export const SECONDARY_RANGE_CHANNEL: SecondaryRangeChannel[] = ['x2', 'y2', 'latitude2', 'longitude2'];

export function isSecondaryRangeChannel(c: Channel): c is SecondaryRangeChannel {
  const main = getMainRangeChannel(c);
  return main !== c;
}

/**
 * Get the main channel for a range channel. E.g. `x` for `x2`.
 */
export function getMainRangeChannel(channel: Channel): Channel {
  switch (channel) {
    case 'x2':
      return 'x';
    case 'y2':
      return 'y';
    case 'latitude2':
      return 'latitude';
    case 'longitude2':
      return 'longitude';
  }
  return channel;
}

/**
 * Get the main channel for a range channel. E.g. `x` for `x2`.
 */
export function getSecondaryRangeChannel(channel: Channel): SecondaryRangeChannel {
  switch (channel) {
    case 'x':
      return 'x2';
    case 'y':
      return 'y2';
    case 'latitude':
      return 'latitude2';
    case 'longitude':
      return 'longitude2';
  }
  return undefined;
}

// CHANNELS without COLUMN, ROW
export const UNIT_CHANNELS = keys(UNIT_CHANNEL_INDEX);

// NONPOSITION_CHANNELS = UNIT_CHANNELS without X, Y, X2, Y2;
const {
  x: _x,
  y: _y,
  // x2 and y2 share the same scale as x and y
  x2: _x2,
  y2: _y2,
  latitude: _latitude,
  longitude: _longitude,
  latitude2: _latitude2,
  longitude2: _longitude2,
  // The rest of unit channels then have scale
  ...NONPOSITION_CHANNEL_INDEX
} = UNIT_CHANNEL_INDEX;

export const NONPOSITION_CHANNELS = keys(NONPOSITION_CHANNEL_INDEX);
export type NonPositionChannel = typeof NONPOSITION_CHANNELS[number];

// POSITION_SCALE_CHANNELS = X and Y;
const POSITION_SCALE_CHANNEL_INDEX = {x: 1, y: 1} as const;
export const POSITION_SCALE_CHANNELS = keys(POSITION_SCALE_CHANNEL_INDEX);
export type PositionScaleChannel = typeof POSITION_SCALE_CHANNELS[number];

export function getSizeType(channel: PositionScaleChannel): 'width' | 'height' {
  return channel === 'x' ? 'width' : 'height';
}

export function getPositionScaleChannel(sizeType: 'width' | 'height'): PositionScaleChannel {
  return sizeType === 'width' ? 'x' : 'y';
}

// NON_POSITION_SCALE_CHANNEL = SCALE_CHANNELS without X, Y
const {
  // x2 and y2 share the same scale as x and y
  // text and tooltip have format instead of scale,
  // href has neither format, nor scale
  text: _t,
  tooltip: _tt,
  href: _hr,
  url: _u,
  // detail and order have no scale
  detail: _dd,
  key: _k,
  order: _oo,
  ...NONPOSITION_SCALE_CHANNEL_INDEX
} = NONPOSITION_CHANNEL_INDEX;
export const NONPOSITION_SCALE_CHANNELS = keys(NONPOSITION_SCALE_CHANNEL_INDEX);
export type NonPositionScaleChannel = typeof NONPOSITION_SCALE_CHANNELS[number];

export function isNonPositionScaleChannel(channel: Channel): channel is NonPositionScaleChannel {
  return !!NONPOSITION_CHANNEL_INDEX[channel];
}

/**
 * @returns whether Vega supports legends for a particular channel
 */
export function supportLegend(channel: NonPositionScaleChannel) {
  switch (channel) {
    case COLOR:
    case FILL:
    case STROKE:
    case SIZE:
    case SHAPE:
    case OPACITY:
    case STROKEWIDTH:
      return true;
    case FILLOPACITY:
    case STROKEOPACITY:
      return false;
  }
}

// Declare SCALE_CHANNEL_INDEX
const SCALE_CHANNEL_INDEX = {
  ...POSITION_SCALE_CHANNEL_INDEX,
  ...NONPOSITION_SCALE_CHANNEL_INDEX
};

/** List of channels with scales */
export const SCALE_CHANNELS = keys(SCALE_CHANNEL_INDEX);
export type ScaleChannel = typeof SCALE_CHANNELS[number];

export function isScaleChannel(channel: Channel): channel is ScaleChannel {
  return !!SCALE_CHANNEL_INDEX[channel];
}

export type SupportedMark = {[mark in Mark]?: 'always' | 'binned'};

/**
 * Return whether a channel supports a particular mark type.
 * @param channel  channel name
 * @param mark the mark type
 * @return whether the mark supports the channel
 */
export function supportMark(channel: Channel, mark: Mark) {
  return getSupportedMark(channel)[mark];
}

const ALL_MARKS: {[m in Mark]: 'always'} = {
  // all marks
  area: 'always',
  bar: 'always',
  circle: 'always',
  geoshape: 'always',
  image: 'always',
  line: 'always',
  rule: 'always',
  point: 'always',
  rect: 'always',
  square: 'always',
  trail: 'always',
  text: 'always',
  tick: 'always'
};

const {geoshape: _g, ...ALL_MARKS_EXCEPT_GEOSHAPE} = ALL_MARKS;

/**
 * Return a dictionary showing whether a channel supports mark type.
 * @param channel
 * @return A dictionary mapping mark types to 'always', 'binned', or undefined
 */
function getSupportedMark(channel: Channel): SupportedMark {
  switch (channel) {
    case COLOR:
    case FILL:
    case STROKE:
    // falls through

    case DETAIL:
    case KEY:
    case TOOLTIP:
    case HREF:
    case ORDER: // TODO: revise (order might not support rect, which is not stackable?)
    case OPACITY:
    case FILLOPACITY:
    case STROKEOPACITY:
    case STROKEWIDTH:
    // falls through

    case FACET:
    case ROW: // falls through
    case COLUMN:
      return ALL_MARKS;
    case X:
    case Y:
    case LATITUDE:
    case LONGITUDE:
      // all marks except geoshape. geoshape does not use X, Y -- it uses a projection
      return ALL_MARKS_EXCEPT_GEOSHAPE;
    case X2:
    case Y2:
    case LATITUDE2:
    case LONGITUDE2:
      return {
        area: 'always',
        bar: 'always',
        image: 'always',
        rect: 'always',
        rule: 'always',
        circle: 'binned',
        point: 'binned',
        square: 'binned',
        tick: 'binned',
        line: 'binned',
        trail: 'binned'
      };
    case SIZE:
      return {
        point: 'always',
        tick: 'always',
        rule: 'always',
        circle: 'always',
        square: 'always',
        bar: 'always',
        text: 'always',
        line: 'always',
        trail: 'always'
      };
    case SHAPE:
      return {point: 'always', geoshape: 'always'};
    case TEXT:
      return {text: 'always'};

    case URL:
      return {image: 'always'};
  }
}

export function rangeType(channel: Channel): RangeType {
  switch (channel) {
    case X:
    case Y:
    case SIZE:
    case STROKEWIDTH:
    case OPACITY:
    case FILLOPACITY:
    case STROKEOPACITY:

    // X2 and Y2 use X and Y scales, so they similarly have continuous range. [falls through]
    case X2:
    case Y2:
      return undefined;

    case FACET:
    case ROW:
    case COLUMN:
    case SHAPE:
    // TEXT, TOOLTIP, URL, and HREF have no scale but have discrete output [falls through]
    case TEXT:
    case TOOLTIP:
    case HREF:
    case URL:
      return 'discrete';

    // Color can be either continuous or discrete, depending on scale type.
    case COLOR:
    case FILL:
    case STROKE:
      return 'flexible';

    // No scale, no range type.

    case LATITUDE:
    case LONGITUDE:
    case LATITUDE2:
    case LONGITUDE2:
    case DETAIL:
    case KEY:
    case ORDER:
      return undefined;
  }
}
