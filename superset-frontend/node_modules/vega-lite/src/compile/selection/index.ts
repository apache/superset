import {Binding, NewSignal, Stream} from 'vega';
import {hasOwnProperty, stringValue} from 'vega-util';
import {FACET_CHANNELS} from '../../channel';
import {
  BrushConfig,
  SelectionInit,
  SelectionInitInterval,
  SelectionResolution,
  SelectionType,
  SELECTION_ID,
  LegendBinding
} from '../../selection';
import {Dict} from '../../util';
import {FacetModel} from '../facet';
import {isFacetModel, Model} from '../model';
import {UnitModel} from '../unit';
import interval from './interval';
import multi from './multi';
import single from './single';
import {SelectionProjection, SelectionProjectionComponent} from './transforms/project';
import {OutputNode} from '../data/dataflow';

export const STORE = '_store';
export const TUPLE = '_tuple';
export const MODIFY = '_modify';
export const SELECTION_DOMAIN = '_selection_domain_';
export const VL_SELECTION_RESOLVE = 'vlSelectionResolve';

export interface SelectionComponent<T extends SelectionType = SelectionType> {
  name: string;
  type: T;
  // Use conditional types for stricter type of init (as the type of init depends on selection type).
  init?: (T extends 'interval'
    ? SelectionInitInterval
    : T extends 'single'
    ? SelectionInit
    : T extends 'multi'
    ? SelectionInit | SelectionInit[]
    : never)[];
  events: Stream[];
  materialized: OutputNode;
  bind?: 'scales' | Binding | Dict<Binding> | LegendBinding;
  resolve: SelectionResolution;
  empty: 'all' | 'none';
  mark?: BrushConfig;

  // Transforms
  project?: SelectionProjectionComponent;
  scales?: SelectionProjection[];
  toggle?: any;
  translate?: any;
  zoom?: any;
  nearest?: any;
  clear?: any;
}

export interface SelectionCompiler<T extends SelectionType = SelectionType> {
  signals: (model: UnitModel, selCmpt: SelectionComponent<T>) => NewSignal[];
  topLevelSignals?: (model: Model, selCmpt: SelectionComponent<T>, signals: NewSignal[]) => NewSignal[];
  modifyExpr: (model: UnitModel, selCmpt: SelectionComponent<T>) => string;
  marks?: (model: UnitModel, selCmpt: SelectionComponent<T>, marks: any[]) => any[];
}

const compilers: Dict<SelectionCompiler> = {single, multi, interval};

export function forEachSelection(
  model: Model,
  cb: (selCmpt: SelectionComponent, selCompiler: SelectionCompiler) => void | boolean
) {
  const selections = model.component.selection;
  if (selections) {
    for (const name in selections) {
      if (hasOwnProperty(selections, name)) {
        const sel = selections[name];
        const success = cb(sel, compilers[sel.type]);
        if (success === true) break;
      }
    }
  }
}

function getFacetModel(model: Model): FacetModel {
  let parent = model.parent;
  while (parent) {
    if (isFacetModel(parent)) {
      break;
    }
    parent = parent.parent;
  }

  return parent as FacetModel;
}

export function unitName(model: Model, {escape} = {escape: true}) {
  let name = escape ? stringValue(model.name) : model.name;
  const facetModel = getFacetModel(model);
  if (facetModel) {
    const {facet} = facetModel;
    for (const channel of FACET_CHANNELS) {
      if (facet[channel]) {
        name += ` + '__facet_${channel}_' + (facet[${stringValue(facetModel.vgField(channel))}])`;
      }
    }
  }
  return name;
}

export function requiresSelectionId(model: Model) {
  let identifier = false;
  forEachSelection(model, selCmpt => {
    identifier = identifier || selCmpt.project.items.some(proj => proj.field === SELECTION_ID);
  });
  return identifier;
}
