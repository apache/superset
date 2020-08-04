import {AxisOrient} from 'vega';
import {FacetChannel, FACET_CHANNELS} from '../../channel';
import {title as fieldDefTitle} from '../../channeldef';
import {contains, getFirstDefined} from '../../util';
import {assembleAxis} from '../axis/assemble';
import {FacetModel} from '../facet';
import {parseGuideResolve} from '../resolve';
import {getHeaderProperty} from './common';
import {HeaderChannel, HeaderComponent} from './component';
import {isArray} from 'vega-util';

export function getHeaderType(orient: AxisOrient) {
  if (orient === 'top' || orient === 'left') {
    return 'header';
  }
  return 'footer';
}

export function parseFacetHeaders(model: FacetModel) {
  for (const channel of FACET_CHANNELS) {
    parseFacetHeader(model, channel);
  }

  mergeChildAxis(model, 'x');
  mergeChildAxis(model, 'y');
}

function parseFacetHeader(model: FacetModel, channel: FacetChannel) {
  if (model.channelHasField(channel)) {
    const fieldDef = model.facet[channel];
    const titleConfig = getHeaderProperty('title', null, model.config, channel);
    let title = fieldDefTitle(fieldDef, model.config, {
      allowDisabling: true,
      includeDefault: titleConfig === undefined || !!titleConfig
    });

    if (model.child.component.layoutHeaders[channel].title) {
      // TODO: better handle multiline titles
      title = isArray(title) ? title.join(', ') : title;

      // merge title with child to produce "Title / Subtitle / Sub-subtitle"
      title += ' / ' + model.child.component.layoutHeaders[channel].title;
      model.child.component.layoutHeaders[channel].title = null;
    }

    const labelOrient = getHeaderProperty('labelOrient', fieldDef, model.config, channel);

    const header = fieldDef.header ?? {};
    const labels = getFirstDefined(header.labels, true);
    const headerType = contains(['bottom', 'right'], labelOrient) ? 'footer' : 'header';

    model.component.layoutHeaders[channel] = {
      title,
      facetFieldDef: fieldDef,
      [headerType]: channel === 'facet' ? [] : [makeHeaderComponent(model, channel, labels)]
    };
  }
}

function makeHeaderComponent(model: FacetModel, channel: HeaderChannel, labels: boolean): HeaderComponent {
  const sizeType = channel === 'row' ? 'height' : 'width';

  return {
    labels,
    sizeSignal: model.child.component.layoutSize.get(sizeType) ? model.child.getSizeSignalRef(sizeType) : undefined,
    axes: []
  };
}

function mergeChildAxis(model: FacetModel, channel: 'x' | 'y') {
  const {child} = model;
  if (child.component.axes[channel]) {
    const {layoutHeaders, resolve} = model.component;
    resolve.axis[channel] = parseGuideResolve(resolve, channel);

    if (resolve.axis[channel] === 'shared') {
      // For shared axis, move the axes to facet's header or footer
      const headerChannel = channel === 'x' ? 'column' : 'row';

      const layoutHeader = layoutHeaders[headerChannel];
      for (const axisComponent of child.component.axes[channel]) {
        const headerType = getHeaderType(axisComponent.get('orient'));
        layoutHeader[headerType] = layoutHeader[headerType] ?? [makeHeaderComponent(model, headerChannel, false)];

        // FIXME: assemble shouldn't be called here, but we do it this way so we only extract the main part of the axes
        const mainAxis = assembleAxis(axisComponent, 'main', model.config, {header: true});
        // LayoutHeader no longer keep track of property precedence, thus let's combine.
        layoutHeader[headerType][0].axes.push(mainAxis);
        axisComponent.mainExtracted = true;
      }
    } else {
      // Otherwise do nothing for independent axes
    }
  }
}
