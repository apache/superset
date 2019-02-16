import { ChartFormData } from '@superset-ui/chart';

// FormData for wordcloud contains both common properties of all form data
// and properties specific to wordcloud vizzes
type WordCloudFormData = ChartFormData & {
  series: string;
};

export default WordCloudFormData;
