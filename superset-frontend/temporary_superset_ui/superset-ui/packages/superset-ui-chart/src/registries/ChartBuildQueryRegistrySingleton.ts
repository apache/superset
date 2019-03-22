import { Registry, makeSingleton, OverwritePolicy } from '@superset-ui/core';
import { QueryContext } from '../types/Query';

// Ideally this would be <T extends ChartFormData>
type BuildQuery = (formData: any) => QueryContext;

class ChartBuildQueryRegistry extends Registry<BuildQuery> {
  constructor() {
    super({ name: 'ChartBuildQuery', overwritePolicy: OverwritePolicy.WARN });
  }
}

const getInstance = makeSingleton(ChartBuildQueryRegistry);

export default getInstance;
