import {SignalRef} from 'vega';
import {contains} from '../../util';
import {isSignalRef} from '../../vega.schema';
import {isConcatModel, isLayerModel, isRepeatModel, Model} from '../model';
import {Projection as VgProjection} from 'vega';

export function assembleProjections(model: Model): VgProjection[] {
  if (isLayerModel(model) || isConcatModel(model) || isRepeatModel(model)) {
    return assembleProjectionsForModelAndChildren(model);
  } else {
    return assembleProjectionForModel(model);
  }
}

export function assembleProjectionsForModelAndChildren(model: Model): VgProjection[] {
  return model.children.reduce((projections, child) => {
    return projections.concat(child.assembleProjections());
  }, assembleProjectionForModel(model));
}

export function assembleProjectionForModel(model: Model): VgProjection[] {
  const component = model.component.projection;
  if (!component || component.merged) {
    return [];
  }

  const projection = component.combine();
  const {name, ...rest} = projection; // we need to extract name so that it is always present in the output and pass TS type validation

  if (!component.data) {
    // generate custom projection, no automatic fitting
    return [
      {
        name,
        // translate to center by default
        ...{translate: {signal: '[width / 2, height / 2]'}},
        // parameters, overwrite default translate if specified
        ...rest
      }
    ];
  } else {
    // generate projection that uses extent fitting
    const size: SignalRef = {
      signal: `[${component.size.map(ref => ref.signal).join(', ')}]`
    };

    const fit: string[] = component.data.reduce((sources, data) => {
      const source: string = isSignalRef(data) ? data.signal : `data('${model.lookupDataSource(data)}')`;
      if (!contains(sources, source)) {
        // build a unique list of sources
        sources.push(source);
      }
      return sources;
    }, []);

    if (fit.length <= 0) {
      throw new Error("Projection's fit didn't find any data sources");
    }

    return [
      {
        name,
        size,
        fit: {
          signal: fit.length > 1 ? `[${fit.join(', ')}]` : fit[0]
        },
        ...rest
      }
    ];
  }
}
