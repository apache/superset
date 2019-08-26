import { QueryFormData } from '@superset-ui/query';
import { FormDataProps } from './Line';

type CombinedFormData = QueryFormData & FormDataProps;

export default CombinedFormData;
