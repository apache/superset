import { ChartFormData } from '@superset-ui/chart';
import { FormDataProps } from './Line';

type CombinedFormData = ChartFormData & FormDataProps;

export default CombinedFormData;
