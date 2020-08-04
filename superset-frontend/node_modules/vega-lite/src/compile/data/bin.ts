import {BinTransform as VgBinTransform, Transforms as VgTransform} from 'vega';
import {isString} from 'vega-util';
import {BinParams, binToString, isBinning, isSelectionExtent} from '../../bin';
import {Channel} from '../../channel';
import {binRequiresRange, FieldName, isTypedFieldDef, normalizeBin, TypedFieldDef, vgField} from '../../channeldef';
import {Config} from '../../config';
import {BinTransform} from '../../transform';
import {Dict, duplicate, hash, keys, replacePathInField, unique, vals, varName} from '../../util';
import {binFormatExpression} from '../common';
import {isUnitModel, Model, ModelWithField} from '../model';
import {parseSelectionBinExtent} from '../selection/parse';
import {DataFlowNode} from './dataflow';

function rangeFormula(model: ModelWithField, fieldDef: TypedFieldDef<string>, channel: Channel, config: Config) {
  if (binRequiresRange(fieldDef, channel)) {
    // read format from axis or legend, if there is no format then use config.numberFormat

    const guide = isUnitModel(model) ? model.axis(channel) ?? model.legend(channel) ?? {} : {};

    const startField = vgField(fieldDef, {expr: 'datum'});
    const endField = vgField(fieldDef, {expr: 'datum', binSuffix: 'end'});

    return {
      formulaAs: vgField(fieldDef, {binSuffix: 'range', forAs: true}),
      formula: binFormatExpression(startField, endField, guide.format, config)
    };
  }
  return {};
}

function binKey(bin: BinParams, field: string) {
  return `${binToString(bin)}_${field}`;
}

function getSignalsFromModel(model: Model, key: string) {
  return {
    signal: model.getName(`${key}_bins`),
    extentSignal: model.getName(`${key}_extent`)
  };
}

export function getBinSignalName(model: Model, field: string, bin: boolean | BinParams) {
  const normalizedBin = normalizeBin(bin, undefined) ?? {};
  const key = binKey(normalizedBin, field);
  return model.getName(`${key}_bins`);
}

function isBinTransform(t: TypedFieldDef<string> | BinTransform): t is BinTransform {
  return 'as' in t;
}

function createBinComponent(t: TypedFieldDef<string> | BinTransform, bin: boolean | BinParams, model: Model) {
  let as: [string, string];
  let span: string;

  if (isBinTransform(t)) {
    as = isString(t.as) ? [t.as, `${t.as}_end`] : [t.as[0], t.as[1]];
  } else {
    as = [vgField(t, {forAs: true}), vgField(t, {binSuffix: 'end', forAs: true})];
  }

  const normalizedBin = {...normalizeBin(bin, undefined)};
  const key = binKey(normalizedBin, t.field);
  const {signal, extentSignal} = getSignalsFromModel(model, key);

  if (isSelectionExtent(normalizedBin.extent)) {
    const ext = normalizedBin.extent;
    const selName = ext.selection;
    span = parseSelectionBinExtent(model.getSelectionComponent(varName(selName), selName), ext);
    delete normalizedBin.extent; // Vega-Lite selection extent map to Vega's span property.
  }

  const binComponent: BinComponent = {
    bin: normalizedBin,
    field: t.field,
    as: [as],
    ...(signal ? {signal} : {}),
    ...(extentSignal ? {extentSignal} : {}),
    ...(span ? {span} : {})
  };

  return {key, binComponent};
}

export interface BinComponent {
  bin: BinParams;
  field: FieldName;
  extentSignal?: string;
  signal?: string;
  span?: string;

  /** Pairs of strings of the names of start and end signals */
  as: [string, string][];

  // Range Formula

  formula?: string;
  formulaAs?: string;
}

export class BinNode extends DataFlowNode {
  public clone() {
    return new BinNode(null, duplicate(this.bins));
  }

  constructor(parent: DataFlowNode, private bins: Dict<BinComponent>) {
    super(parent);
  }

  public static makeFromEncoding(parent: DataFlowNode, model: ModelWithField) {
    const bins = model.reduceFieldDef((binComponentIndex: Dict<BinComponent>, fieldDef, channel) => {
      if (isTypedFieldDef(fieldDef) && isBinning(fieldDef.bin)) {
        const {key, binComponent} = createBinComponent(fieldDef, fieldDef.bin, model);
        binComponentIndex[key] = {
          ...binComponent,
          ...binComponentIndex[key],
          ...rangeFormula(model, fieldDef, channel, model.config)
        };
      }
      return binComponentIndex;
    }, {} as Dict<BinComponent>);

    if (keys(bins).length === 0) {
      return null;
    }

    return new BinNode(parent, bins);
  }

  /**
   * Creates a bin node from BinTransform.
   * The optional parameter should provide
   */
  public static makeFromTransform(parent: DataFlowNode, t: BinTransform, model: Model) {
    const {key, binComponent} = createBinComponent(t, t.bin, model);
    return new BinNode(parent, {
      [key]: binComponent
    });
  }

  /**
   * Merge bin nodes. This method either integrates the bin config from the other node
   * or if this node already has a bin config, renames the corresponding signal in the model.
   */
  public merge(other: BinNode, renameSignal: (s1: string, s2: string) => void) {
    for (const key of keys(other.bins)) {
      if (key in this.bins) {
        renameSignal(other.bins[key].signal, this.bins[key].signal);
        // Ensure that we don't have duplicate names for signal pairs
        this.bins[key].as = unique([...this.bins[key].as, ...other.bins[key].as], hash);
      } else {
        this.bins[key] = other.bins[key];
      }
    }

    for (const child of other.children) {
      other.removeChild(child);
      child.parent = this;
    }
    other.remove();
  }

  public producedFields() {
    return new Set(
      vals(this.bins)
        .map(c => c.as)
        .flat(2)
    );
  }

  public dependentFields() {
    return new Set(vals(this.bins).map(c => c.field));
  }

  public hash() {
    return `Bin ${hash(this.bins)}`;
  }

  public assemble(): VgTransform[] {
    return vals(this.bins).flatMap(bin => {
      const transform: VgTransform[] = [];

      const [binAs, ...remainingAs] = bin.as;
      const {extent, ...params} = bin.bin;
      const binTrans: VgBinTransform = {
        type: 'bin',
        field: replacePathInField(bin.field),
        as: binAs,
        signal: bin.signal,
        ...(!isSelectionExtent(extent) ? {extent} : {extent: null}),
        ...(bin.span ? {span: {signal: `span(${bin.span})`}} : {}),
        ...params
      };

      if (!extent && bin.extentSignal) {
        transform.push({
          type: 'extent',
          field: replacePathInField(bin.field),
          signal: bin.extentSignal
        });
        binTrans.extent = {signal: bin.extentSignal};
      }

      transform.push(binTrans);

      for (const as of remainingAs) {
        for (let i = 0; i < 2; i++) {
          transform.push({
            type: 'formula',
            expr: vgField({field: binAs[i]}, {expr: 'datum'}),
            as: as[i]
          });
        }
      }

      if (bin.formula) {
        transform.push({
          type: 'formula',
          expr: bin.formula,
          as: bin.formulaAs
        });
      }
      return transform;
    });
  }
}
