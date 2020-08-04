import {SelectionCompiler, TUPLE, unitName} from '.';
import {singleOrMultiSignals} from './multi';

const single: SelectionCompiler<'single'> = {
  signals: singleOrMultiSignals,

  modifyExpr: (model, selCmpt) => {
    const tpl = selCmpt.name + TUPLE;
    return tpl + ', ' + (selCmpt.resolve === 'global' ? 'true' : `{unit: ${unitName(model)}}`);
  }
};

export default single;
