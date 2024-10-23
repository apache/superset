import { buildQueryContext, QueryObject } from '@superset-ui/core';

export default function buildQuery(formData: any) {
  const { metric, minVal, maxVal } = formData;

  return buildQueryContext(formData, (baseQueryObject: QueryObject) => [{
    ...baseQueryObject,
    metrics: [metric],  // Select the main metric for the Speedometer
    filters: baseQueryObject.filters || [],  // Pass any user-applied filters
    extras: {
      ...baseQueryObject.extras,
      minVal,  // Pass the minimum value if specified
      maxVal,  // Pass the maximum value if specified
    },
  }]);
}
