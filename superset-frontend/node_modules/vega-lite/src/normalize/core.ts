import {isArray} from 'vega-util';
import {COLUMN, FACET, ROW} from '../channel';
import {Field} from '../channeldef';
import {boxPlotNormalizer} from '../compositemark/boxplot';
import {errorBandNormalizer} from '../compositemark/errorband';
import {errorBarNormalizer} from '../compositemark/errorbar';
import {channelHasField, Encoding} from '../encoding';
import * as log from '../log';
import {Projection} from '../projection';
import {ExtendedLayerSpec, FacetedUnitSpec, GenericSpec, UnitSpec} from '../spec';
import {GenericCompositionLayoutWithColumns} from '../spec/base';
import {
  FacetEncodingFieldDef,
  FacetFieldDef,
  FacetMapping,
  GenericFacetSpec,
  isFacetMapping,
  NormalizedFacetSpec
} from '../spec/facet';
import {GenericLayerSpec, NormalizedLayerSpec} from '../spec/layer';
import {SpecMapper} from '../spec/map';
import {GenericRepeatSpec} from '../spec/repeat';
import {isUnitSpec, NormalizedUnitSpec} from '../spec/unit';
import {keys, omit} from '../util';
import {NonFacetUnitNormalizer, NormalizerParams} from './base';
import {PathOverlayNormalizer} from './pathoverlay';
import {RangeStepNormalizer} from './rangestep';
import {RuleForRangedLineNormalizer} from './ruleforrangedline';

export class CoreNormalizer extends SpecMapper<NormalizerParams, FacetedUnitSpec, ExtendedLayerSpec> {
  private nonFacetUnitNormalizers: NonFacetUnitNormalizer<any>[] = [
    boxPlotNormalizer,
    errorBarNormalizer,
    errorBandNormalizer,
    new PathOverlayNormalizer(),
    new RuleForRangedLineNormalizer(),
    new RangeStepNormalizer()
  ];

  public map(spec: GenericSpec<FacetedUnitSpec, ExtendedLayerSpec>, params: NormalizerParams) {
    // Special handling for a faceted unit spec as it can return a facet spec, not just a layer or unit spec like a normal unit spec.
    if (isUnitSpec(spec)) {
      const hasRow = channelHasField(spec.encoding, ROW);
      const hasColumn = channelHasField(spec.encoding, COLUMN);
      const hasFacet = channelHasField(spec.encoding, FACET);

      if (hasRow || hasColumn || hasFacet) {
        return this.mapFacetedUnit(spec, params);
      }
    }

    return super.map(spec, params);
  }

  // This is for normalizing non-facet unit
  public mapUnit(spec: UnitSpec, params: NormalizerParams): NormalizedUnitSpec | NormalizedLayerSpec {
    const {parentEncoding, parentProjection} = params;
    if (parentEncoding || parentProjection) {
      return this.mapUnitWithParentEncodingOrProjection(spec, params);
    }

    const normalizeLayerOrUnit = this.mapLayerOrUnit.bind(this);

    for (const unitNormalizer of this.nonFacetUnitNormalizers) {
      if (unitNormalizer.hasMatchingType(spec, params.config)) {
        return unitNormalizer.run(spec, params, normalizeLayerOrUnit);
      }
    }

    return spec as NormalizedUnitSpec;
  }

  protected mapRepeat(
    spec: GenericRepeatSpec<UnitSpec, ExtendedLayerSpec>,
    params: NormalizerParams
  ): GenericRepeatSpec<NormalizedUnitSpec, NormalizedLayerSpec> {
    const {repeat} = spec;

    if (!isArray(repeat) && spec.columns) {
      // is repeat with row/column
      spec = omit(spec, ['columns']);
      log.warn(log.message.columnsNotSupportByRowCol('repeat'));
    }

    return {
      ...spec,
      spec: this.map(spec.spec, params)
    };
  }

  protected mapFacet(
    spec: GenericFacetSpec<UnitSpec, ExtendedLayerSpec>,
    params: NormalizerParams
  ): GenericFacetSpec<NormalizedUnitSpec, NormalizedLayerSpec> {
    const {facet} = spec;

    if (isFacetMapping(facet) && spec.columns) {
      // is facet with row/column
      spec = omit(spec, ['columns']);
      log.warn(log.message.columnsNotSupportByRowCol('facet'));
    }

    return super.mapFacet(spec, params);
  }

  private mapUnitWithParentEncodingOrProjection(
    spec: FacetedUnitSpec,
    params: NormalizerParams
  ): NormalizedUnitSpec | NormalizedLayerSpec {
    const {encoding, projection} = spec;
    const {parentEncoding, parentProjection, config} = params;
    const mergedProjection = mergeProjection({parentProjection, projection});
    const mergedEncoding = mergeEncoding({parentEncoding, encoding});
    return this.mapUnit(
      {
        ...spec,
        ...(mergedProjection ? {projection: mergedProjection} : {}),
        ...(mergedEncoding ? {encoding: mergedEncoding} : {})
      },
      {config}
    );
  }

  private mapFacetedUnit(spec: FacetedUnitSpec, params: NormalizerParams): NormalizedFacetSpec {
    // New encoding in the inside spec should not contain row / column
    // as row/column should be moved to facet
    const {row, column, facet, ...encoding} = spec.encoding;

    // Mark and encoding should be moved into the inner spec
    const {mark, width, projection, height, selection, encoding: _, ...outerSpec} = spec;

    const {facetMapping, layout} = this.getFacetMappingAndLayout({row, column, facet});

    return this.mapFacet(
      {
        ...outerSpec,
        ...layout,

        // row / column has higher precedence than facet
        facet: facetMapping,
        spec: {
          ...(projection ? {projection} : {}),
          mark,
          ...(width ? {width} : {}),
          ...(height ? {height} : {}),
          encoding,
          ...(selection ? {selection} : {})
        }
      },
      params
    );
  }

  private getFacetMappingAndLayout(facets: {
    row: FacetEncodingFieldDef<Field>;
    column: FacetEncodingFieldDef<Field>;
    facet: FacetEncodingFieldDef<Field>;
  }): {facetMapping: FacetMapping<Field> | FacetFieldDef<Field>; layout: GenericCompositionLayoutWithColumns} {
    const {row, column, facet} = facets;

    if (row || column) {
      if (facet) {
        log.warn(log.message.facetChannelDropped([...(row ? [ROW] : []), ...(column ? [COLUMN] : [])]));
      }

      const facetMapping = {};
      const layout = {};

      for (const channel of [ROW, COLUMN]) {
        const def = facets[channel];
        if (def) {
          const {align, center, spacing, columns, ...defWithoutLayout} = def;
          facetMapping[channel] = defWithoutLayout;

          for (const prop of ['align', 'center', 'spacing'] as const) {
            if (def[prop] !== undefined) {
              layout[prop] = layout[prop] ?? {};
              layout[prop][channel] = def[prop];
            }
          }
        }
      }

      return {facetMapping, layout};
    } else {
      const {align, center, spacing, columns, ...facetMapping} = facet;
      return {
        facetMapping,
        layout: {
          ...(align ? {align} : {}),
          ...(center ? {center} : {}),
          ...(spacing ? {spacing} : {}),
          ...(columns ? {columns} : {})
        }
      };
    }
  }

  public mapLayer(
    spec: ExtendedLayerSpec,
    {parentEncoding, parentProjection, ...otherParams}: NormalizerParams
  ): GenericLayerSpec<NormalizedUnitSpec> {
    // Special handling for extended layer spec

    const {encoding, projection, ...rest} = spec;
    const params: NormalizerParams = {
      ...otherParams,
      parentEncoding: mergeEncoding({parentEncoding, encoding}),
      parentProjection: mergeProjection({parentProjection, projection})
    };
    return super.mapLayer(rest, params);
  }
}

function mergeEncoding(opt: {parentEncoding: Encoding<any>; encoding: Encoding<any>}): Encoding<any> {
  const {parentEncoding, encoding} = opt;
  if (parentEncoding && encoding) {
    const overriden = keys(parentEncoding).reduce((o, key) => {
      if (encoding[key]) {
        o.push(key);
      }
      return o;
    }, []);

    if (overriden.length > 0) {
      log.warn(log.message.encodingOverridden(overriden));
    }
  }

  const merged = {
    ...(parentEncoding ?? {}),
    ...(encoding ?? {})
  };
  return keys(merged).length > 0 ? merged : undefined;
}

function mergeProjection(opt: {parentProjection: Projection; projection: Projection}) {
  const {parentProjection, projection} = opt;
  if (parentProjection && projection) {
    log.warn(log.message.projectionOverridden({parentProjection, projection}));
  }
  return projection ?? parentProjection;
}
