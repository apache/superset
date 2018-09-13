import LoaderRegistry from '../../platform/LoaderRegistry';
import makeSingleton from '../../utils/makeSingleton';

class TransformPropsRegistry extends LoaderRegistry {
  constructor() {
    super('TransformProps');
  }
}

const getInstance = makeSingleton(TransformPropsRegistry);

function loadTransformProps(key) {
  return getInstance().load(key);
}

export {
  getInstance,
  loadTransformProps,
};
