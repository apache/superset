import { ChartFormData } from '@superset-ui/chart';
import { RenderingFormData } from './Line';

type CombinedFormData = ChartFormData & RenderingFormData;

export default CombinedFormData;
