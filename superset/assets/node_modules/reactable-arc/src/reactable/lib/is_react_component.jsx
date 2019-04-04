// this is a bit hacky - it'd be nice if React exposed an API for this
export function isReactComponent(thing) {
    return thing !== null && typeof(thing) === 'object' && typeof(thing.props) !== 'undefined';
}
