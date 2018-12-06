import { FormData as GenericFormData } from 'src/query';

// FormData specific to the wordcloud viz
interface WordCloudFormData {
  series: string;
}

// FormData for wordcloud contains both common properties of all form data
// and properties specific to wordcloud vizzes
type FormData = GenericFormData & WordCloudFormData;
export default FormData;
