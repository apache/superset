import BigNumberTotalTest from './_big_number_total';
import CompareTest from './_compare';
import DistBarTest from './_dist_bar';
import HistogramTest from './_histogram';
import LineTest from './_line';
import TableTest from './_table';

describe('All Visualizations', () => {
  BigNumberTotalTest();
  CompareTest();
  DistBarTest();
  HistogramTest();
  LineTest();
  TableTest();
});
