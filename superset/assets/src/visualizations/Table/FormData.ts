import { FormData as GenericFormData } from 'src/query';
import { RawMetric } from 'src/query/Metric';

// FormData specific to the wordcloud viz
interface TableFormData {
  all_columns: string[];
  percent_metrics: RawMetric[];
  include_time: boolean;
  order_by_cols: any[];
}

// FormData for wordcloud contains both common properties of all form data
// and properties specific to wordcloud vizzes
type FormData = GenericFormData & TableFormData;
export default FormData;
