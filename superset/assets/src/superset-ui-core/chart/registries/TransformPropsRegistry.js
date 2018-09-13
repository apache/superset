import LoaderRegistry from '../../platform/LoaderRegistry';
import makeSingleton from '../../utils/makeSingleton';

class TransformPropsRegistry extends LoaderRegistry {
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
} = makeSingleton(TransformPropsRegistry);

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
