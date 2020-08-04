import {Signal, SignalRef} from 'vega';
import {selector as parseSelector} from 'vega-event-selector';
import {identity, isArray, stringValue} from 'vega-util';
import {forEachSelection, MODIFY, STORE, unitName, VL_SELECTION_RESOLVE, TUPLE} from '.';
import {dateTimeToExpr, isDateTime, dateTimeToTimestamp} from '../../datetime';
import {SelectionInit, SelectionInitInterval, SelectionExtent} from '../../selection';
import {keys, varName} from '../../util';
import {VgData} from '../../vega.schema';
import {FacetModel} from '../facet';
import {LayerModel} from '../layer';
import {isUnitModel, Model} from '../model';
import {UnitModel} from '../unit';
import {forEachTransform} from './transforms/transforms';
import {parseSelectionBinExtent} from './parse';

export function assembleInit(
  init: readonly (SelectionInit | readonly SelectionInit[] | SelectionInitInterval)[] | SelectionInit,
  isExpr = true,
  wrap: (str: string | number) => string | number = identity
): any {
  if (isArray(init)) {
    const assembled = init.map(v => assembleInit(v, isExpr, wrap));
    return isExpr ? `[${assembled.join(', ')}]` : assembled;
  } else if (isDateTime(init)) {
    if (isExpr) {
      return wrap(dateTimeToExpr(init));
    } else {
      return wrap(dateTimeToTimestamp(init));
    }
  }
  return isExpr ? wrap(JSON.stringify(init)) : init;
}

export function assembleUnitSelectionSignals(model: UnitModel, signals: Signal[]) {
  forEachSelection(model, (selCmpt, selCompiler) => {
    const name = selCmpt.name;
    let modifyExpr = selCompiler.modifyExpr(model, selCmpt);

    signals.push(...selCompiler.signals(model, selCmpt));

    forEachTransform(selCmpt, txCompiler => {
      if (txCompiler.signals) {
        signals = txCompiler.signals(model, selCmpt, signals);
      }
      if (txCompiler.modifyExpr) {
        modifyExpr = txCompiler.modifyExpr(model, selCmpt, modifyExpr);
      }
    });

    signals.push({
      name: name + MODIFY,
      on: [
        {
          events: {signal: selCmpt.name + TUPLE},
          update: `modify(${stringValue(selCmpt.name + STORE)}, ${modifyExpr})`
        }
      ]
    });
  });

  return cleanupEmptyOnArray(signals);
}

export function assembleFacetSignals(model: FacetModel, signals: Signal[]) {
  if (model.component.selection && keys(model.component.selection).length) {
    const name = stringValue(model.getName('cell'));
    signals.unshift({
      name: 'facet',
      value: {},
      on: [
        {
          events: parseSelector('mousemove', 'scope'),
          update: `isTuple(facet) ? facet : group(${name}).datum`
        }
      ]
    });
  }

  return cleanupEmptyOnArray(signals);
}

export function assembleTopLevelSignals(model: UnitModel, signals: Signal[]) {
  let hasSelections = false;
  forEachSelection(model, (selCmpt, selCompiler) => {
    const name = selCmpt.name;
    const store = stringValue(name + STORE);
    const hasSg = signals.filter(s => s.name === name);
    if (hasSg.length === 0) {
      const resolve = selCmpt.resolve === 'global' ? 'union' : selCmpt.resolve;
      const isMulti = selCmpt.type === 'multi' ? ', true)' : ')';
      signals.push({
        name: selCmpt.name,
        update: `${VL_SELECTION_RESOLVE}(${store}, ${stringValue(resolve)}${isMulti}`
      });
    }
    hasSelections = true;

    if (selCompiler.topLevelSignals) {
      signals = selCompiler.topLevelSignals(model, selCmpt, signals);
    }

    forEachTransform(selCmpt, txCompiler => {
      if (txCompiler.topLevelSignals) {
        signals = txCompiler.topLevelSignals(model, selCmpt, signals);
      }
    });
  });

  if (hasSelections) {
    const hasUnit = signals.filter(s => s.name === 'unit');
    if (hasUnit.length === 0) {
      signals.unshift({
        name: 'unit',
        value: {},
        on: [{events: 'mousemove', update: 'isTuple(group()) ? group() : unit'}]
      });
    }
  }

  return cleanupEmptyOnArray(signals);
}

export function assembleUnitSelectionData(model: UnitModel, data: readonly VgData[]): VgData[] {
  const dataCopy = [...data];
  forEachSelection(model, selCmpt => {
    const init: VgData = {name: selCmpt.name + STORE};
    if (selCmpt.init) {
      const fields = selCmpt.project.items.map(proj => {
        const {signals, ...rest} = proj;
        return rest;
      });

      const insert = selCmpt.init.map(i => assembleInit(i, false));
      init.values =
        selCmpt.type === 'interval'
          ? [{unit: unitName(model, {escape: false}), fields, values: insert}]
          : insert.map(i => ({unit: unitName(model, {escape: false}), fields, values: i}));
    }
    const contains = dataCopy.filter(d => d.name === selCmpt.name + STORE);
    if (!contains.length) {
      dataCopy.push(init);
    }
  });

  return dataCopy;
}

export function assembleUnitSelectionMarks(model: UnitModel, marks: any[]): any[] {
  forEachSelection(model, (selCmpt, selCompiler) => {
    marks = selCompiler.marks ? selCompiler.marks(model, selCmpt, marks) : marks;
    forEachTransform(selCmpt, txCompiler => {
      if (txCompiler.marks) {
        marks = txCompiler.marks(model, selCmpt, marks);
      }
    });
  });

  return marks;
}

export function assembleLayerSelectionMarks(model: LayerModel, marks: any[]): any[] {
  for (const child of model.children) {
    if (isUnitModel(child)) {
      marks = assembleUnitSelectionMarks(child, marks);
    }
  }

  return marks;
}

export function assembleSelectionScaleDomain(model: Model, extent: SelectionExtent): SignalRef {
  const name = extent.selection;
  const selCmpt = model.getSelectionComponent(name, varName(name));
  return {signal: parseSelectionBinExtent(selCmpt, extent)};
}

function cleanupEmptyOnArray(signals: Signal[]) {
  return signals.map(s => {
    if (s.on && !s.on.length) delete s.on;
    return s;
  });
}
