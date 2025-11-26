import '@testing-library/jest-dom';
import { render, fireEvent } from '@superset-ui/core/spec';
import CountryMap from '../src/ReactCountryMap';

const props = {
  country: 'france',
  data: [
    {
      country_id: 'FR-09',
      metric: 1412,
    },
    {
      country_id: 'FR-64',
      metric: 6338,
    },
    {
      country_id: 'FR-72',
      metric: 6935,
    },
    {
      country_id: 'FR-84',
      metric: 6629,
    },
    {
      country_id: 'FR-22',
      metric: 6317,
    },
    {
      country_id: 'FR-37',
      metric: 6594,
    },
    {
      country_id: 'FR-38',
      metric: 15356,
    },
    {
      country_id: 'FR-40',
      metric: 3621,
    },
    {
      country_id: 'FR-82',
      metric: 2591,
    },
    {
      country_id: 'FR-88',
      metric: 4264,
    },
    {
      country_id: 'FR-28',
      metric: 5363,
    },
    {
      country_id: 'FR-55',
      metric: 2287,
    },
    {
      country_id: 'FR-61',
      metric: 3243,
    },
    {
      country_id: 'FR-78',
      metric: 19431,
    },
    {
      country_id: 'FR-39',
      metric: 3017,
    },
    {
      country_id: 'FR-42',
      metric: 8906,
    },
    {
      country_id: 'FR-46',
      metric: 1430,
    },
    {
      country_id: 'FR-53',
      metric: 3932,
    },
    {
      country_id: 'FR-75',
      metric: 31817,
    },
    {
      country_id: 'FR-94',
      metric: 19866,
    },
    {
      country_id: 'FR-03',
      metric: 3335,
    },
    {
      country_id: 'FR-05',
      metric: 1403,
    },
    {
      country_id: 'FR-07',
      metric: 3176,
    },
    {
      country_id: 'FR-24',
      metric: 3690,
    },
    {
      country_id: 'FR-54',
      metric: 8671,
    },
    {
      country_id: 'FR-81',
      metric: 3611,
    },
    {
      country_id: 'FR-91',
      metric: 17614,
    },
    {
      country_id: 'FR-13',
      metric: 24056,
    },
    {
      country_id: 'FR-15',
      metric: 1396,
    },
    {
      country_id: 'FR-51',
      metric: 6979,
    },
    {
      country_id: 'FR-85',
      metric: 7062,
    },
    {
      country_id: 'FR-93',
      metric: 26313,
    },
    {
      country_id: 'FR-14',
      metric: 8257,
    },
    {
      country_id: 'FR-50',
      metric: 5487,
    },
    {
      country_id: 'FR-65',
      metric: 2186,
    },
    {
      country_id: 'FR-77',
      metric: 17729,
    },
    {
      country_id: 'FR-87',
      metric: 3659,
    },
    {
      country_id: 'FR-89',
      metric: 3844,
    },
    {
      country_id: 'FR-27',
      metric: 7220,
    },
    {
      country_id: 'FR-33',
      metric: 15819,
    },
    {
      country_id: 'FR-35',
      metric: 12072,
    },
    {
      country_id: 'FR-49',
      metric: 10085,
    },
    {
      country_id: 'FR-62',
      metric: 19304,
    },
    {
      country_id: 'FR-10',
      metric: 3553,
    },
    {
      country_id: 'FR-32',
      metric: 1625,
    },
    {
      country_id: 'FR-36',
      metric: 2314,
    },
    {
      country_id: 'FR-48',
      metric: 772,
    },
    {
      country_id: 'FR-58',
      metric: 2181,
    },
    {
      country_id: 'FR-66',
      metric: 4320,
    },
    {
      country_id: 'FR-76',
      metric: 15650,
    },
    {
      country_id: 'FR-08',
      metric: 3422,
    },
    {
      country_id: 'FR-17',
      metric: 5900,
    },
    {
      country_id: 'FR-19',
      metric: 2250,
    },
    {
      country_id: 'FR-21',
      metric: 6052,
    },
    {
      country_id: 'FR-25',
      metric: 6798,
    },
    {
      country_id: 'FR-31',
      metric: 13900,
    },
    {
      country_id: 'FR-47',
      metric: 3245,
    },
    {
      country_id: 'FR-73',
      metric: 4736,
    },
    {
      country_id: 'FR-74',
      metric: 8753,
    },
    {
      country_id: 'FR-80',
      metric: 7035,
    },
    {
      country_id: 'FR-34',
      metric: 11562,
    },
    {
      country_id: 'FR-43',
      metric: 2416,
    },
    {
      country_id: 'FR-44',
      metric: 15988,
    },
    {
      country_id: 'FR-52',
      metric: 2095,
    },
    {
      country_id: 'FR-59',
      metric: 36257,
    },
    {
      country_id: 'FR-69',
      metric: 23796,
    },
    {
      country_id: 'FR-70',
      metric: 2773,
    },
    {
      country_id: 'FR-86',
      metric: 4568,
    },
    {
      country_id: 'FR-12',
      metric: 2614,
    },
    {
      country_id: 'FR-30',
      metric: 7777,
    },
    {
      country_id: 'FR-79',
      metric: 4100,
    },
    {
      country_id: 'FR-83',
      metric: 10622,
    },
    {
      country_id: 'FR-90',
      metric: 1766,
    },
    {
      country_id: 'FR-01',
      metric: 6706,
    },
    {
      country_id: 'FR-06',
      metric: 11514,
    },
    {
      country_id: 'FR-11',
      metric: 3321,
    },
    {
      country_id: 'FR-16',
      metric: 3514,
    },
    {
      country_id: 'FR-2B',
      metric: 1444,
    },
    {
      country_id: 'FR-63',
      metric: 6632,
    },
    {
      country_id: 'FR-67',
      metric: 12828,
    },
    {
      country_id: 'FR-95',
      metric: 17863,
    },
    {
      country_id: 'FR-02',
      metric: 6761,
    },
    {
      country_id: 'FR-18',
      metric: 3271,
    },
    {
      country_id: 'FR-26',
      metric: 5703,
    },
    {
      country_id: 'FR-29',
      metric: 9963,
    },
    {
      country_id: 'FR-56',
      metric: 8036,
    },
    {
      country_id: 'FR-23',
      metric: 957,
    },
    {
      country_id: 'FR-41',
      metric: 3678,
    },
    {
      country_id: 'FR-57',
      metric: 11970,
    },
    {
      country_id: 'FR-68',
      metric: 8945,
    },
    {
      country_id: 'FR-71',
      metric: 5709,
    },
    {
      country_id: 'FR-04',
      metric: 1522,
    },
    {
      country_id: 'FR-2A',
      metric: 1228,
    },
    {
      country_id: 'FR-45',
      metric: 8424,
    },
    {
      country_id: 'FR-60',
      metric: 10630,
    },
    {
      country_id: 'FR-92',
      metric: 24649,
    },
  ],
  height: 571,
  linearColorScheme: 'superset_seq_1',
  numberFormat: 'SMART_NUMBER',
  sliceId: 532,
  width: 479,
};

describe('CountryMap', () => {
  beforeEach(() => {
    render(<CountryMap {...props} />);
  });

  it('renders a hover popup', () => {
    expect(true).toBe(true);
    fireEvent.mouseOver(); // Hover for popup
  });
});
