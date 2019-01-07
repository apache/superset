/* eslint-disable sort-keys */

import SequentialScheme from '../../SequentialScheme';

const schemes = [
  {
    id: 'blue_white_yellow',
    label: 'blue/white/yellow',
    colors: ['#00d1c1', 'white', '#ffb400'],
  },
  {
    id: 'fire',
    colors: ['white', 'yellow', 'red', 'black'],
  },
  {
    id: 'white_black',
    label: 'white/black',
    colors: ['white', 'black'],
  },
  {
    id: 'black_white',
    label: 'black/white',
    colors: ['black', 'white'],
  },
  {
    id: 'dark_blue',
    label: 'dark blues',
    colors: ['#EBF5F8', '#6BB1CC', '#357E9B', '#1B4150', '#092935'],
  },
  {
    id: 'pink_grey',
    label: 'pink/grey',
    isDiverging: true,
    colors: ['#E70B81', '#FAFAFA', '#666666'],
  },
  {
    id: 'greens',
    colors: ['#ffffcc', '#78c679', '#006837'],
  },
  {
    id: 'purples',
    colors: ['#f2f0f7', '#9e9ac8', '#54278f'],
  },
  {
    id: 'oranges',
    colors: ['#fef0d9', '#fc8d59', '#b30000'],
  },
  {
    id: 'red_yellow_blue',
    label: 'red/yellow/blue',
    isDiverging: true,
    colors: ['#d7191c', '#fdae61', '#ffffbf', '#abd9e9', '#2c7bb6'],
  },
  {
    id: 'brown_white_green',
    label: 'brown/white/green',
    isDiverging: true,
    colors: ['#a6611a', '#dfc27d', '#f5f5f5', '#80cdc1', '#018571'],
  },
  {
    id: 'purple_white_green',
    label: 'purple/white/green',
    isDiverging: true,
    colors: ['#7b3294', '#c2a5cf', '#f7f7f7', '#a6dba0', '#008837'],
  },
].map(s => new SequentialScheme(s));

export default schemes;
