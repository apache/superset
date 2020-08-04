import {DataPrefix, IndexPrefix, ScalePrefix} from './constants';
import {Literal} from 'vega-expression';
import {error, hasOwnProperty} from 'vega-util';

export function dataVisitor(name, args, scope, params) {
  if (args[0].type !== Literal) {
    error('First argument to data functions must be a string literal.');
  }

  const data = args[0].value,
        dataName = DataPrefix + data;

  if (!hasOwnProperty(dataName, params)) {
    try {
      params[dataName] = scope.getData(data).tuplesRef();
    } catch (err) {
      // if data set does not exist, there's nothing to track
    }
  }
}

export function indataVisitor(name, args, scope, params) {
  if (args[0].type !== Literal) error('First argument to indata must be a string literal.');
  if (args[1].type !== Literal) error('Second argument to indata must be a string literal.');

  const data = args[0].value,
        field = args[1].value,
        indexName = IndexPrefix + field;

  if (!hasOwnProperty(indexName, params)) {
    params[indexName] = scope.getData(data).indataRef(scope, field);
  }
}

export function scaleVisitor(name, args, scope, params) {
  if (args[0].type === Literal) {
    // add scale dependency
    addScaleDependency(scope, params, args[0].value);
  } else {
    // indirect scale lookup; add all scales as parameters
    for (name in scope.scales) {
      addScaleDependency(scope, params, name);
    }
  }
}

function addScaleDependency(scope, params, name) {
  const scaleName = ScalePrefix + name;
  if (!hasOwnProperty(params, scaleName)) {
    try {
      params[scaleName] = scope.scaleRef(name);
    } catch (err) {
      // TODO: error handling? warning?
    }
  }
}
