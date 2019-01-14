import buildQueryContext from 'src/query';
import FormData from './FormData';

export default function buildQuery(formData: FormData) {
  // Set the single QueryObject's groupby field with series in formData
  return buildQueryContext(formData, (baseQueryObject) => [{
    ...baseQueryObject,
  }]);
}
