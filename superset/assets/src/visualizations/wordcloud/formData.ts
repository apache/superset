import { FormData as GenericFormData } from 'src/query/formData';

// FormData specific to the wordcloud viz
interface WordCloudFormData {
  series: string;
}

// FormData for wordcloud contains both common properties of all form data
// and properties specific to wordcloud vizzes
export type FormData = GenericFormData & WordCloudFormData;
