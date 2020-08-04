import {Legend as VgLegend, LegendEncode} from 'vega';
import {keys, replaceAll, stringify, vals} from '../../util';
import {isSignalRef, VgEncodeChannel, VgValueRef} from '../../vega.schema';
import {Model} from '../model';
import {LegendComponent} from './component';
import {mergeLegendComponent} from './parse';

function setLegendEncode(
  legend: VgLegend,
  part: keyof LegendEncode,
  vgProp: VgEncodeChannel,
  vgRef: VgValueRef | VgValueRef[]
) {
  legend.encode = legend.encode ?? {};
  legend.encode[part] = legend.encode[part] ?? {};
  legend.encode[part].update = legend.encode[part].update ?? {};
  // TODO: remove as any after https://github.com/prisma/nexus-prisma/issues/291
  (legend.encode[part].update[vgProp] as any) = vgRef;
}

export function assembleLegends(model: Model): VgLegend[] {
  const legendComponentIndex = model.component.legends;
  const legendByDomain: {[domainHash: string]: LegendComponent[]} = {};

  for (const channel of keys(legendComponentIndex)) {
    const scaleComponent = model.getScaleComponent(channel);
    const domainHash = stringify(scaleComponent.get('domains'));
    if (legendByDomain[domainHash]) {
      for (const mergedLegendComponent of legendByDomain[domainHash]) {
        const merged = mergeLegendComponent(mergedLegendComponent, legendComponentIndex[channel]);
        if (!merged) {
          // If cannot merge, need to add this legend separately
          legendByDomain[domainHash].push(legendComponentIndex[channel]);
        }
      }
    } else {
      legendByDomain[domainHash] = [legendComponentIndex[channel].clone()];
    }
  }

  return vals(legendByDomain)
    .flat()
    .map((legendCmpt: LegendComponent) => {
      const {labelExpr, selections, ...legend} = legendCmpt.combine();

      if (legend.encode?.symbols) {
        const out = legend.encode.symbols.update;
        if (out.fill && out.fill['value'] !== 'transparent' && !out.stroke && !legend.stroke) {
          // For non color channel's legend, we need to override symbol stroke config from Vega config if stroke channel is not used.
          out.stroke = {value: 'transparent'};
        }

        if (legend.fill) {
          // If top-level fill is defined, for non color channel's legend, we need remove fill.
          delete out.fill;
        }
      }

      if (labelExpr !== undefined) {
        let expr = labelExpr;
        if (legend.encode?.labels?.update?.text && isSignalRef(legend.encode.labels.update.text)) {
          expr = replaceAll(labelExpr, 'datum.label', legend.encode.labels.update.text.signal);
        }

        setLegendEncode(legend, 'labels', 'text', {signal: expr});
      }

      return legend;
    });
}
