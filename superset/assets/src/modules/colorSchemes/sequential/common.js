import SequentialColorScheme from '../../SequentialColorScheme';

const schemes = [
  {
    name: 'blue_white_yellow',
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
    colors: [
      'white',
      'black',
    ],
  },
  {
    name: 'black_white',
    colors: [
      'black',
      'white',
    ],
  },
  {
    name: 'dark_blue',
    colors: [
      '#EBF5F8',
      '#6BB1CC',
      '#357E9B',
      '#1B4150',
      '#092935',
    ],
  },
].map(s => new SequentialColorScheme(s));

export default schemes;
