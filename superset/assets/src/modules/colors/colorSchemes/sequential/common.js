import SequentialScheme from '../../SequentialScheme';

const schemes = [
  {
    name: 'blue_white_yellow',
    label: 'blue/white/yellow',
    colors: [
      '#00d1c1',
      'white',
      '#ffb400',
    ],
  },
  {
    name: 'fire',
    colors: [
      'white',
      'yellow',
      'red',
      'black',
    ],
  },
  {
    name: 'white_black',
    label: 'white/black',
    colors: [
      'white',
      'black',
    ],
  },
  {
    name: 'black_white',
    label: 'black/white',
    colors: [
      'black',
      'white',
    ],
  },
  {
    name: 'dark_blue',
    label: 'dark blues',
    colors: [
      '#EBF5F8',
      '#6BB1CC',
      '#357E9B',
      '#1B4150',
      '#092935',
    ],
  },
  {
    name: 'pink_grey',
    label: 'pink/grey',
    colors: [
      '#E70B81',
      '#FAFAFA',
      '#666666',
    ],
    isDiverging: true,
  },
  {
    name: 'greens',
    colors: [
      '#ffffcc',
      '#78c679',
      '#006837',
    ],
  },
  {
    name: 'purples',
    colors: [
      '#f2f0f7',
      '#9e9ac8',
      '#54278f',
    ],
  },
  {
    name: 'oranges',
    colors: [
      '#fef0d9',
      '#fc8d59',
      '#b30000',
    ],
  },
  {
    name: 'red_yellow_blue',
    label: 'red/yellow/blue',
    colors: [
      '#d7191c',
      '#fdae61',
      '#ffffbf',
      '#abd9e9',
      '#2c7bb6',
    ],
    isDiverging: true,
  },
  {
    name: 'brown_white_green',
    label: 'brown/white/green',
    colors: [
      '#a6611a',
      '#dfc27d',
      '#f5f5f5',
      '#80cdc1',
      '#018571',
    ],
    isDiverging: true,
  },
  {
    name: 'purple_white_green',
    label: 'purple/white/green',
    colors: [
      '#7b3294',
      '#c2a5cf',
      '#f7f7f7',
      '#a6dba0',
      '#008837',
    ],
    isDiverging: true,
  },
].map(s => new SequentialScheme(s));

export default schemes;
