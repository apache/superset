import {Orient} from 'vega';
import {FacetChannel} from '../../channel';
import {Config} from '../../config';
import {Header} from '../../header';
import {FacetFieldDef} from '../../spec/facet';
import {contains, getFirstDefined} from '../../util';
import {HeaderChannel} from './component';

/**
 * Get header channel, which can be different from facet channel when orient is specified or when the facet channel is facet.
 */
export function getHeaderChannel(channel: FacetChannel, orient: Orient): HeaderChannel {
  if (contains(['top', 'bottom'], orient)) {
    return 'column';
  } else if (contains(['left', 'right'], orient)) {
    return 'row';
  }
  return channel === 'row' ? 'row' : 'column';
}

export function getHeaderProperty<P extends keyof Header>(
  prop: P,
  facetFieldDef: FacetFieldDef<string>,
  config: Config,
  channel: FacetChannel
): Header[P] {
  const headerSpecificConfig =
    channel === 'row' ? config.headerRow : channel === 'column' ? config.headerColumn : config.headerFacet;

  return getFirstDefined(
    facetFieldDef && facetFieldDef.header ? facetFieldDef.header[prop] : undefined,
    headerSpecificConfig[prop],
    config.header[prop]
  );
}

export function getHeaderProperties(
  properties: (keyof Header)[],
  facetFieldDef: FacetFieldDef<string>,
  config: Config,
  channel: FacetChannel
): Header {
  const props = {};
  for (const prop of properties) {
    const value = getHeaderProperty(prop, facetFieldDef, config, channel);
    if (value !== undefined) {
      props[prop] = value;
    }
  }
  return props;
}
