import { Registry, makeSingleton, OverwritePolicy, QueryContext } from '../..';

// Ideally this would be <T extends QueryFormData>
type BuildQuery = (formData: any) => QueryContext;

class ChartBuildQueryRegistry extends Registry<BuildQuery> {
  constructor() {
    super({ name: 'ChartBuildQuery', overwritePolicy: OverwritePolicy.WARN });
  }
}

const getInstance = makeSingleton(ChartBuildQueryRegistry);

export default getInstance;
