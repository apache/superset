import {ifOrient, ifX} from './axis-util';
import {Bottom, GuideLabelStyle, GuideTitleStyle, Top} from './constants';
import {isSignal} from '../../util';
import {extend, hasOwnProperty} from 'vega-util';

function fallback(prop, config, axisConfig, style) {
  let styleProp;

  if (config && hasOwnProperty(config, prop)) {
    return config[prop];
  }
  else if (hasOwnProperty(axisConfig, prop)) {
    return axisConfig[prop];
  }
  else if (prop.startsWith('title')) {
    switch (prop) {
      case 'titleColor':
        styleProp = 'fill';
        break;
      case 'titleFont':
      case 'titleFontSize':
      case 'titleFontWeight':
        styleProp = prop[5].toLowerCase() + prop.slice(6);
    }
    return style[GuideTitleStyle][styleProp];
  }
  else if (prop.startsWith('label')) {
    switch (prop) {
      case 'labelColor':
        styleProp = 'fill';
        break;
      case 'labelFont':
      case 'labelFontSize':
        styleProp = prop[5].toLowerCase() + prop.slice(6);
    }
    return style[GuideLabelStyle][styleProp];
  }

  return null;
}

function keys(objects) {
  const map = {};
  for (const obj of objects) {
    if (!obj) continue;
    for (const key in obj) map[key] = 1;
  }
  return Object.keys(map);
}

export default function(spec, scope) {
  var config = scope.config,
      style = config.style,
      axis = config.axis,
      band = scope.scaleType(spec.scale) === 'band' && config.axisBand,
      orient = spec.orient,
      xy, or, key;

  if (isSignal(orient)) {
    const xyKeys = keys([
            config.axisX, config.axisY
          ]),
          orientKeys = keys([
            config.axisTop, config.axisBottom,
            config.axisLeft, config.axisRight
          ]);

    xy = {};
    for (key of xyKeys) {
      xy[key] = ifX(
        orient,
        fallback(key, config.axisX, axis, style),
        fallback(key, config.axisY, axis, style)
      );
    }

    or = {};
    for (key of orientKeys) {
      or[key] = ifOrient(
        orient.signal,
        fallback(key, config.axisTop, axis, style),
        fallback(key, config.axisBottom, axis, style),
        fallback(key, config.axisLeft, axis, style),
        fallback(key, config.axisRight, axis, style)
      );
    }
  } else {
    xy = (orient === Top || orient === Bottom) ? config.axisX : config.axisY;
    or = config['axis' + orient[0].toUpperCase() + orient.slice(1)];
  }

  var result = (xy || or || band)
    ? extend({}, axis, xy, or, band)
    : axis;

  return result;
}
