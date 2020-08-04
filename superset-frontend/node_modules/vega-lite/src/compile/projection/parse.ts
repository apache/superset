import {SignalRef} from 'vega';
import {hasOwnProperty} from 'vega-util';
import {LATITUDE, LATITUDE2, LONGITUDE, LONGITUDE2, SHAPE} from '../../channel';
import {MAIN} from '../../data';
import {PROJECTION_PROPERTIES} from '../../projection';
import {GEOJSON} from '../../type';
import {duplicate, every, stringify} from '../../util';
import {isUnitModel, Model} from '../model';
import {UnitModel} from '../unit';
import {ProjectionComponent} from './component';

export function parseProjection(model: Model) {
  model.component.projection = isUnitModel(model) ? parseUnitProjection(model) : parseNonUnitProjections(model);
}

function parseUnitProjection(model: UnitModel): ProjectionComponent {
  if (model.hasProjection) {
    const proj = model.specifiedProjection;
    const fit = !(proj && (proj.scale != null || proj.translate != null));
    const size = fit ? [model.getSizeSignalRef('width'), model.getSizeSignalRef('height')] : undefined;
    const data = fit ? gatherFitData(model) : undefined;

    return new ProjectionComponent(
      model.projectionName(true),
      {
        ...(model.config.projection ?? {}),
        ...(proj ?? {})
      },
      size,
      data
    );
  }

  return undefined;
}

function gatherFitData(model: UnitModel) {
  const data: (SignalRef | string)[] = [];

  for (const posssiblePair of [
    [LONGITUDE, LATITUDE],
    [LONGITUDE2, LATITUDE2]
  ]) {
    if (model.channelHasField(posssiblePair[0]) || model.channelHasField(posssiblePair[1])) {
      data.push({
        signal: model.getName(`geojson_${data.length}`)
      });
    }
  }

  if (model.channelHasField(SHAPE) && model.fieldDef(SHAPE).type === GEOJSON) {
    data.push({
      signal: model.getName(`geojson_${data.length}`)
    });
  }

  if (data.length === 0) {
    // main source is geojson, so we can just use that
    data.push(model.requestDataName(MAIN));
  }

  return data;
}

function mergeIfNoConflict(first: ProjectionComponent, second: ProjectionComponent): ProjectionComponent {
  const allPropertiesShared = every(PROJECTION_PROPERTIES, prop => {
    // neither has the property
    if (!hasOwnProperty(first.explicit, prop) && !hasOwnProperty(second.explicit, prop)) {
      return true;
    }
    // both have property and an equal value for property
    if (
      hasOwnProperty(first.explicit, prop) &&
      hasOwnProperty(second.explicit, prop) &&
      // some properties might be signals or objects and require hashing for comparison
      stringify(first.get(prop)) === stringify(second.get(prop))
    ) {
      return true;
    }
    return false;
  });

  const size = stringify(first.size) === stringify(second.size);
  if (size) {
    if (allPropertiesShared) {
      return first;
    } else if (stringify(first.explicit) === stringify({})) {
      return second;
    } else if (stringify(second.explicit) === stringify({})) {
      return first;
    }
  }

  // if all properties don't match, let each unit spec have its own projection
  return null;
}

function parseNonUnitProjections(model: Model): ProjectionComponent {
  if (model.children.length === 0) {
    return undefined;
  }

  let nonUnitProjection: ProjectionComponent;

  // parse all children first
  model.children.forEach(child => parseProjection(child));

  // analyze parsed projections, attempt to merge
  const mergable = every(model.children, child => {
    const projection = child.component.projection;
    if (!projection) {
      // child layer does not use a projection
      return true;
    } else if (!nonUnitProjection) {
      // cached 'projection' is null, cache this one
      nonUnitProjection = projection;
      return true;
    } else {
      const merge = mergeIfNoConflict(nonUnitProjection, projection);
      if (merge) {
        nonUnitProjection = merge;
      }
      return !!merge;
    }
  });

  // if cached one and all other children share the same projection,
  if (nonUnitProjection && mergable) {
    // so we can elevate it to the layer level
    const name = model.projectionName(true);
    const modelProjection = new ProjectionComponent(
      name,
      nonUnitProjection.specifiedProjection,
      nonUnitProjection.size,
      duplicate(nonUnitProjection.data)
    );

    // rename and assign all others as merged
    model.children.forEach(child => {
      const projection = child.component.projection;
      if (projection) {
        if (projection.isFit) {
          modelProjection.data.push(...child.component.projection.data);
        }
        child.renameProjection(projection.get('name'), name);
        projection.merged = true;
      }
    });

    return modelProjection;
  }

  return undefined;
}
