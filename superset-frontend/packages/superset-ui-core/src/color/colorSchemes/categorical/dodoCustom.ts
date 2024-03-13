// DODO was here

import CategoricalScheme from '../../CategoricalScheme';

const schemes = [
  {
    id: 'dodoCustom',
    label: 'Dodo Custom Colors',
    colors: [
      'black',
      'red',
      'green',
      'yellow',
      'brown',
      'cyan',
      'purple',
      'blue',
    ],
  },
].map(s => new CategoricalScheme(s));

export default schemes;
