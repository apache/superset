import {Legend as VgLegend, NewSignal, Title as VgTitle} from 'vega';
import {Config} from '../config';
import * as log from '../log';
import {isLayerSpec, isUnitSpec, LayoutSizeMixins, NormalizedLayerSpec} from '../spec';
import {keys} from '../util';
import {VgData, VgLayout} from '../vega.schema';
import {assembleAxisSignals} from './axis/assemble';
import {parseLayerAxes} from './axis/parse';
import {parseData} from './data/parse';
import {assembleLayoutSignals} from './layoutsize/assemble';
import {parseLayerLayoutSize} from './layoutsize/parse';
import {assembleLegends} from './legend/assemble';
import {Model} from './model';
import {RepeaterValue} from './repeater';
import {assembleLayerSelectionMarks} from './selection/assemble';
import {UnitModel} from './unit';

export class LayerModel extends Model {
  // HACK: This should be (LayerModel | UnitModel)[], but setting the correct type leads to weird error.
  // So I'm just putting generic Model for now
  public readonly children: Model[];

  constructor(
    spec: NormalizedLayerSpec,
    parent: Model,
    parentGivenName: string,
    parentGivenSize: LayoutSizeMixins,
    repeater: RepeaterValue,
    config: Config
  ) {
    super(spec, 'layer', parent, parentGivenName, config, repeater, spec.resolve, spec.view);

    const layoutSize = {
      ...parentGivenSize,
      ...(spec.width ? {width: spec.width} : {}),
      ...(spec.height ? {height: spec.height} : {})
    };

    this.children = spec.layer.map((layer, i) => {
      if (isLayerSpec(layer)) {
        return new LayerModel(layer, this, this.getName('layer_' + i), layoutSize, repeater, config);
      } else if (isUnitSpec(layer)) {
        return new UnitModel(layer, this, this.getName('layer_' + i), layoutSize, repeater, config);
      }

      throw new Error(log.message.invalidSpec(layer));
    });
  }

  public parseData() {
    this.component.data = parseData(this);
    for (const child of this.children) {
      child.parseData();
    }
  }

  public parseLayoutSize() {
    parseLayerLayoutSize(this);
  }

  public parseSelections() {
    // Merge selections up the hierarchy so that they may be referenced
    // across unit specs. Persist their definitions within each child
    // to assemble signals which remain within output Vega unit groups.
    this.component.selection = {};
    for (const child of this.children) {
      child.parseSelections();
      keys(child.component.selection).forEach(key => {
        this.component.selection[key] = child.component.selection[key];
      });
    }
  }

  public parseMarkGroup() {
    for (const child of this.children) {
      child.parseMarkGroup();
    }
  }

  public parseAxesAndHeaders() {
    parseLayerAxes(this);
  }

  public assembleSelectionTopLevelSignals(signals: NewSignal[]): NewSignal[] {
    return this.children.reduce((sg, child) => child.assembleSelectionTopLevelSignals(sg), signals);
  }

  // TODO: Support same named selections across children.
  public assembleSignals(): NewSignal[] {
    return this.children.reduce((signals, child) => {
      return signals.concat(child.assembleSignals());
    }, assembleAxisSignals(this));
  }

  public assembleLayoutSignals(): NewSignal[] {
    return this.children.reduce((signals, child) => {
      return signals.concat(child.assembleLayoutSignals());
    }, assembleLayoutSignals(this));
  }

  public assembleSelectionData(data: readonly VgData[]): readonly VgData[] {
    return this.children.reduce((db, child) => child.assembleSelectionData(db), data);
  }

  public assembleTitle(): VgTitle {
    let title = super.assembleTitle();
    if (title) {
      return title;
    }
    // If title does not provide layer, look into children
    for (const child of this.children) {
      title = child.assembleTitle();
      if (title) {
        return title;
      }
    }
    return undefined;
  }

  public assembleLayout(): VgLayout {
    return null;
  }

  public assembleMarks(): any[] {
    return assembleLayerSelectionMarks(
      this,
      this.children.flatMap(child => {
        return child.assembleMarks();
      })
    );
  }

  public assembleLegends(): VgLegend[] {
    return this.children.reduce((legends, child) => {
      return legends.concat(child.assembleLegends());
    }, assembleLegends(this));
  }
}
