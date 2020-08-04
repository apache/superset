export default function(spec, scope) {
  return spec && spec.signal ? scope.signalRef(spec.signal)
    : spec === false ? false
    : true;
}
