import { Registry, makeSingleton, OverwritePolicy } from '../..';
import { TransformProps } from '../types/TransformFunction';

class ChartTransformPropsRegistry extends Registry<TransformProps> {
  constructor() {
    super({ name: 'ChartTransformProps', overwritePolicy: OverwritePolicy.WARN });
  }
}

const getInstance = makeSingleton(ChartTransformPropsRegistry);

export default getInstance;
