import {selector as parseSelector} from 'vega-event-selector';
import {hasOwnProperty, isString, stringValue} from 'vega-util';
import {forEachSelection, SelectionComponent, STORE} from '.';
import {warn} from '../../log';
import {LogicalComposition} from '../../logical';
import {SelectionDef, SelectionExtent} from '../../selection';
import {Dict, duplicate, logicalExpr, varName} from '../../util';
import {DataFlowNode, OutputNode} from '../data/dataflow';
import {FilterNode} from '../data/filter';
import {Model} from '../model';
import {UnitModel} from '../unit';
import {forEachTransform} from './transforms/transforms';

export function parseUnitSelection(model: UnitModel, selDefs: Dict<SelectionDef>) {
  const selCmpts: Dict<SelectionComponent<any /* this has to be "any" so typing won't fail in test files*/>> = {};
  const selectionConfig = model.config.selection;

  for (const name in selDefs) {
    if (!hasOwnProperty(selDefs, name)) {
      continue;
    }

    const selDef = duplicate(selDefs[name]);
    const {fields, encodings, ...cfg} = selectionConfig[selDef.type]; // Project transform applies its defaults.

    // Set default values from config if a property hasn't been specified,
    // or if it is true. E.g., "translate": true should use the default
    // event handlers for translate. However, true may be a valid value for
    // a property (e.g., "nearest": true).
    for (const key in cfg) {
      // A selection should contain either `encodings` or `fields`, only use
      // default values for these two values if neither of them is specified.
      if ((key === 'encodings' && selDef.fields) || (key === 'fields' && selDef.encodings)) {
        continue;
      }

      if (key === 'mark') {
        selDef[key] = {...cfg[key], ...selDef[key]};
      }

      if (selDef[key] === undefined || selDef[key] === true) {
        selDef[key] = cfg[key] ?? selDef[key];
      }
    }

    const safeName = varName(name);
    const selCmpt = (selCmpts[safeName] = {
      ...selDef,
      name: safeName,
      events: isString(selDef.on) ? parseSelector(selDef.on, 'scope') : duplicate(selDef.on)
    } as any);

    forEachTransform(selCmpt, txCompiler => {
      if (txCompiler.has(selCmpt) && txCompiler.parse) {
        txCompiler.parse(model, selCmpt, selDef, selDefs[name]);
      }
    });
  }

  return selCmpts;
}

export function parseSelectionPredicate(
  model: Model,
  selections: LogicalComposition<string>,
  dfnode?: DataFlowNode,
  datum = 'datum'
): string {
  const stores: string[] = [];
  function expr(name: string): string {
    const vname = varName(name);
    const selCmpt = model.getSelectionComponent(vname, name);
    const store = stringValue(vname + STORE);

    if (selCmpt.project.timeUnit) {
      const child = dfnode ?? model.component.data.raw;
      const tunode = selCmpt.project.timeUnit.clone();
      if (child.parent) {
        tunode.insertAsParentOf(child);
      } else {
        child.parent = tunode;
      }
    }

    if (selCmpt.empty !== 'none') {
      stores.push(store);
    }

    return (
      `vlSelectionTest(${store}, ${datum}` + (selCmpt.resolve === 'global' ? ')' : `, ${stringValue(selCmpt.resolve)})`)
    );
  }

  const predicateStr = logicalExpr(selections, expr);
  return (
    (stores.length ? '!(' + stores.map(s => `length(data(${s}))`).join(' || ') + ') || ' : '') + `(${predicateStr})`
  );
}

export function parseSelectionBinExtent(selCmpt: SelectionComponent, extent: SelectionExtent) {
  const encoding = extent['encoding'];
  let field = extent['field'];

  if (!encoding && !field) {
    field = selCmpt.project.items[0].field;
    if (selCmpt.project.items.length > 1) {
      warn(
        'A "field" or "encoding" must be specified when using a selection as a scale domain. ' +
          `Using "field": ${stringValue(field)}.`
      );
    }
  } else if (encoding && !field) {
    const encodings = selCmpt.project.items.filter(p => p.channel === encoding);
    if (!encodings.length || encodings.length > 1) {
      field = selCmpt.project.items[0].field;
      warn(
        (!encodings.length ? 'No ' : 'Multiple ') +
          `matching ${stringValue(encoding)} encoding found for selection ${stringValue(extent.selection)}. ` +
          `Using "field": ${stringValue(field)}.`
      );
    } else {
      field = encodings[0].field;
    }
  }

  return `${selCmpt.name}[${stringValue(field)}]`;
}

export function materializeSelections(model: UnitModel, main: OutputNode) {
  forEachSelection(model, selCmpt => {
    const selection = selCmpt.name;
    const lookupName = model.getName(`lookup_${selection}`);
    model.component.data.outputNodes[lookupName] = selCmpt.materialized = new OutputNode(
      new FilterNode(main, model, {selection}),
      lookupName,
      'lookup',
      model.component.data.outputNodeRefCounts
    );
  });
}
