const { floor } = Math;
const finite = isFinite;

export default Number.isInteger || /* istanbul ignore next */ ((x) => (typeof x === 'number' && finite(x) && floor(x) === x));
