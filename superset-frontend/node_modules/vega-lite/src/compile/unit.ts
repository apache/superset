import {NewSignal} from 'vega';
import {Axis} from '../axis';
import {
  Channel,
  GEOPOSITION_CHANNELS,
  NONPOSITION_SCALE_CHANNELS,
  ScaleChannel,
  SCALE_CHANNELS,
  SingleDefChannel,
  supportLegend,
  X,
  Y
} from '../channel';
import {getTypedFieldDef, hasConditionalFieldDef, isFieldDef, TypedFieldDef} from '../channeldef';
import {Config} from '../config';
import {isGraticuleGenerator} from '../data';
import * as vlEncoding from '../encoding';
import {Encoding, normalizeEncoding} from '../encoding';
import {Legend} from '../legend';
import {GEOSHAPE, isMarkDef, Mark, MarkDef} from '../mark';
import {Projection} from '../projection';
import {Domain, Scale} from '../scale';
import {SelectionDef} from '../selection';
import {LayoutSizeMixins, NormalizedUnitSpec} from '../spec';
import {isFrameMixins} from '../spec/base';
import {stack, StackProperties} from '../stack';
import {Dict} from '../util';
import {VgData, VgLayout} from '../vega.schema';
import {assembleAxisSignals} from './axis/assemble';
import {AxisIndex} from './axis/component';
import {parseUnitAxes} from './axis/parse';
import {parseData} from './data/parse';
import {assembleLayoutSignals} from './layoutsize/assemble';
import {initLayoutSize} from './layoutsize/init';
import {parseUnitLayoutSize} from './layoutsize/parse';
import {LegendIndex} from './legend/component';
import {normalizeMarkDef} from './mark/init';
import {parseMarkGroups} from './mark/mark';
import {isLayerModel, Model, ModelWithField} from './model';
import {RepeaterValue, replaceRepeaterInEncoding} from './repeater';
import {ScaleIndex} from './scale/component';
import {
  assembleTopLevelSignals,
  assembleUnitSelectionData,
  assembleUnitSelectionMarks,
  assembleUnitSelectionSignals
} from './selection/assemble';
import {parseUnitSelection} from './selection/parse';

/**
 * Internal model of Vega-Lite specification for the compiler.
 */
export class UnitModel extends ModelWithField {
  public readonly markDef: MarkDef;
  public readonly encoding: Encoding<string>;

  public readonly specifiedScales: ScaleIndex = {};

  public readonly stack: StackProperties;

  protected specifiedAxes: AxisIndex = {};

  protected specifiedLegends: LegendIndex = {};

  public specifiedProjection: Projection = {};

  public readonly selection: Dict<SelectionDef> = {};
  public children: Model[] = [];

  constructor(
    spec: NormalizedUnitSpec,
    parent: Model,
    parentGivenName: string,
    parentGivenSize: LayoutSizeMixins = {},
    repeater: RepeaterValue,
    config: Config
  ) {
    super(
      spec,
      'unit',
      parent,
      parentGivenName,
      config,
      repeater,
      undefined,
      isFrameMixins(spec) ? spec.view : undefined
    );

    const mark = isMarkDef(spec.mark) ? spec.mark.type : spec.mark;

    const encodingWithRepeaterReplaced = replaceRepeaterInEncoding(spec.encoding ?? {}, repeater);

    this.markDef = normalizeMarkDef(spec.mark, encodingWithRepeaterReplaced, config, {
      graticule: spec.data && isGraticuleGenerator(spec.data)
    });
    const encoding = (this.encoding = normalizeEncoding(encodingWithRepeaterReplaced, this.markDef));

    this.size = initLayoutSize({
      encoding,
      size: isFrameMixins(spec)
        ? {
            ...parentGivenSize,
            ...(spec.width ? {width: spec.width} : {}),
            ...(spec.height ? {height: spec.height} : {})
          }
        : parentGivenSize
    });

    // calculate stack properties
    this.stack = stack(mark, encoding);
    this.specifiedScales = this.initScales(mark, encoding);

    this.specifiedAxes = this.initAxes(encoding);
    this.specifiedLegends = this.initLegend(encoding);
    this.specifiedProjection = spec.projection;

    // Selections will be initialized upon parse.
    this.selection = spec.selection;
  }

  public get hasProjection(): boolean {
    const {encoding} = this;
    const isGeoShapeMark = this.mark === GEOSHAPE;
    const hasGeoPosition = encoding && GEOPOSITION_CHANNELS.some(channel => isFieldDef(encoding[channel]));
    return isGeoShapeMark || hasGeoPosition;
  }

  /**
   * Return specified Vega-Lite scale domain for a particular channel
   * @param channel
   */
  public scaleDomain(channel: ScaleChannel): Domain {
    const scale = this.specifiedScales[channel];
    return scale ? scale.domain : undefined;
  }

  public axis(channel: Channel): Axis {
    return this.specifiedAxes[channel];
  }

  public legend(channel: Channel): Legend {
    return this.specifiedLegends[channel];
  }

  private initScales(mark: Mark, encoding: Encoding<string>): ScaleIndex {
    return SCALE_CHANNELS.reduce((scales, channel) => {
      let fieldDef: TypedFieldDef<string>;
      let specifiedScale: Scale;

      const channelDef = encoding[channel];

      if (isFieldDef(channelDef)) {
        fieldDef = channelDef;
        specifiedScale = channelDef.scale;
      } else if (hasConditionalFieldDef<string, any>(channelDef)) {
        // Need to specify generic for hasConditionalFieldDef as the value type can vary across channels
        fieldDef = channelDef.condition;
        specifiedScale = channelDef.condition['scale'];
      }

      if (fieldDef) {
        scales[channel] = specifiedScale ?? {};
      }
      return scales;
    }, {} as ScaleIndex);
  }

  private initAxes(encoding: Encoding<string>): AxisIndex {
    return [X, Y].reduce((_axis, channel) => {
      // Position Axis

      // TODO: handle ConditionFieldDef
      const channelDef = encoding[channel];
      if (
        isFieldDef(channelDef) ||
        (channel === X && isFieldDef(encoding.x2)) ||
        (channel === Y && isFieldDef(encoding.y2))
      ) {
        const axisSpec = isFieldDef(channelDef) ? channelDef.axis : null;

        if (axisSpec !== null) {
          _axis[channel] = {
            ...axisSpec
          };
        }
      }
      return _axis;
    }, {});
  }

  private initLegend(encoding: Encoding<string>): LegendIndex {
    return NONPOSITION_SCALE_CHANNELS.reduce((_legend, channel) => {
      const channelDef = encoding[channel];
      if (channelDef) {
        const legend = isFieldDef(channelDef)
          ? channelDef.legend
          : hasConditionalFieldDef<string, any>(channelDef) // Need to specify generic for hasConditionalFieldDef as the value type can vary across channels
          ? channelDef.condition['legend']
          : null;

        if (legend !== null && legend !== false && supportLegend(channel)) {
          _legend[channel] = {...legend};
        }
      }

      return _legend;
    }, {});
  }

  public parseData() {
    this.component.data = parseData(this);
  }

  public parseLayoutSize() {
    parseUnitLayoutSize(this);
  }

  public parseSelections() {
    this.component.selection = parseUnitSelection(this, this.selection);
  }

  public parseMarkGroup() {
    this.component.mark = parseMarkGroups(this);
  }

  public parseAxesAndHeaders() {
    this.component.axes = parseUnitAxes(this);
  }

  public assembleSelectionTopLevelSignals(signals: any[]): NewSignal[] {
    return assembleTopLevelSignals(this, signals);
  }

  public assembleSignals(): NewSignal[] {
    return [...assembleAxisSignals(this), ...assembleUnitSelectionSignals(this, [])];
  }

  public assembleSelectionData(data: readonly VgData[]): VgData[] {
    return assembleUnitSelectionData(this, data);
  }

  public assembleLayout(): VgLayout {
    return null;
  }

  public assembleLayoutSignals(): NewSignal[] {
    return assembleLayoutSignals(this);
  }

  public assembleMarks() {
    let marks = this.component.mark ?? [];

    // If this unit is part of a layer, selections should augment
    // all in concert rather than each unit individually. This
    // ensures correct interleaving of clipping and brushed marks.
    if (!this.parent || !isLayerModel(this.parent)) {
      marks = assembleUnitSelectionMarks(this, marks);
    }

    return marks.map(this.correctDataNames);
  }

  protected getMapping() {
    return this.encoding;
  }

  public get mark(): Mark {
    return this.markDef.type;
  }

  public channelHasField(channel: Channel) {
    return vlEncoding.channelHasField(this.encoding, channel);
  }

  public fieldDef(channel: SingleDefChannel) {
    const channelDef = this.encoding[channel];
    return getTypedFieldDef<string>(channelDef);
  }
}
