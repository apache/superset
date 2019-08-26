import { QueryFormData } from '@superset-ui/query';

// FormData for wordcloud contains both common properties of all form data
// and properties specific to wordcloud vizzes
type WordCloudFormData = QueryFormData & {
  series: string;
};

export default WordCloudFormData;
