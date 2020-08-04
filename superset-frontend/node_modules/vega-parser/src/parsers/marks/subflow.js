import {PreFacet, Sieve} from '../../transforms';

export default function(spec, scope, input) {
  var op = scope.add(PreFacet({pulse: input.pulse})),
      subscope = scope.fork();

  subscope.add(Sieve());
  subscope.addSignal('parent', null);

  // parse group mark subflow
  op.params.subflow = {
    $subflow: subscope.parse(spec).toRuntime()
  };
}
