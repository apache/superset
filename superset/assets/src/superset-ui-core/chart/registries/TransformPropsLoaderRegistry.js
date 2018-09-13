import LoaderRegistry from '../../platform/LoaderRegistry';
import makeSingleton from '../../utils/makeSingleton';

class TransformPropsLoaderRegistry extends LoaderRegistry {
  constructor() {
    super('TransformProps');
  }
}

const {
  getInstance,
  has,
  register,
  registerLoader,
  load,
} = makeSingleton(TransformPropsLoaderRegistry);

// alias
const loadTransformProps = load;

export {
  getInstance,
  has,
  register,
  registerLoader,
  load,
  loadTransformProps,
};
