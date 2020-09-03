import CategoricalScheme from '../../CategoricalScheme';

const schemes = [
  {
    id: 'bnbColors',
    label: 'Airbnb Colors',
    colors: [
      '#ff5a5f', // rausch
      '#7b0051', // hackb
      '#007A87', // kazan
      '#00d1c1', // babu
      '#8ce071', // lima
      '#ffb400', // beach
      '#b4a76c', // barol
      '#ff8083',
      '#cc0086',
      '#00a1b3',
      '#00ffeb',
      '#bbedab',
      '#ffd266',
      '#cbc29a',
      '#ff3339',
      '#ff1ab1',
      '#005c66',
      '#00b3a5',
      '#55d12e',
      '#b37e00',
      '#988b4e',
    ],
  },
].map(s => new CategoricalScheme(s));

export default schemes;
