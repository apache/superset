import CategoricalScheme from '../../CategoricalScheme';

const schemes = [
  {
    id: 'googleCategory10c',
    label: 'Google Category 10c',
    colors: [
      '#3366cc',
      '#dc3912',
      '#ff9900',
      '#109618',
      '#990099',
      '#0099c6',
      '#dd4477',
      '#66aa00',
      '#b82e2e',
      '#316395',
    ],
  },
  {
    id: 'googleCategory20c',
    label: 'Google Category 20c',
    colors: [
      '#3366cc',
      '#dc3912',
      '#ff9900',
      '#109618',
      '#990099',
      '#0099c6',
      '#dd4477',
      '#66aa00',
      '#b82e2e',
      '#316395',
      '#994499',
      '#22aa99',
      '#aaaa11',
      '#6633cc',
      '#e67300',
      '#8b0707',
      '#651067',
      '#329262',
      '#5574a6',
      '#3b3eac',
    ],
  },
].map(s => new CategoricalScheme(s));

export default schemes;
