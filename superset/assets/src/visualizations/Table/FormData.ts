import { FormData as GenericFormData } from 'src/query';

// FormData specific to the wordcloud viz
interface TableFormData {
  metrics?: string;
  time_range?: string;
}

// FormData for wordcloud contains both common properties of all form data
// and properties specific to wordcloud vizzes
type FormData = GenericFormData & TableFormData;
export default FormData;
