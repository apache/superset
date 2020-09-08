/**
 * Peak Branded Custom Color Schemes
 *
 * There are 10 colors used in each color scheme. Each color scheme start with a different color and
 * followed by matching or contrast color. So that users gets an option to use each brand color.
 */
import { CategoricalScheme } from '@superset-ui/color';

const schemes = [
    {
        id: 'peakColorSchemeOne',
        label: 'Peak Scheme - Start Dark Blue',
        colors: ['#041537', '#2a44d4', '#9659da', '#ff3c82', '#ffdb21', '#73f692', '#4a90e2', '#f5a623', '#d0021b', '#417505'],
    },
    {
        id: 'peakColorSchemeTwo',
        label: 'Peak Scheme - Start Light Green',
        colors: ['#73f692', '#ffdb21', '#ff3c82', '#9659da', '#041537', '#2a44d4', '#4a90e2', '#f5a623', '#d0021b', '#417505'],
    },
    {
        id: 'peakColorSchemeThree',
        label: 'Peak Scheme - Start Dark Yellow',
        colors: ['#f5a623', '#d0021b', '#417505', '#041537', '#2a44d4', '#4a90e2', '#9659da', '#ff3c82', '#ffdb21', '#73f692'],
    },
    {
        id: 'peakColorSchemeFour',
        label: 'Peak Scheme - Start Red',
        colors: ['#d0021b', '#ff3c82', '#9659da', '#f5a623', '#ffdb21', '#041537', '#2a44d4', '#4a90e2', '#417505', '#73f692'],
    },
    {
        id: 'peakColorSchemeFive',
        label: 'Peak Scheme - Start Blue',
        colors: ['#2a44d4', '#ff3c82', '#73f692', '#ffdb21', '#9659da', '#d0021b', '#f5a623', '#041537', '#4a90e2', '#417505'],
    },
    {
        id: 'peakColorSchemeSix',
        label: 'Peak Scheme - Start Pink',
        colors: ['#ff3c82', '#73f692', '#ffdb21', '#9659da', '#2a44d4', '#d0021b', '#f5a623', '#041537', '#4a90e2', '#417505'],
    },
    {
        id: 'peakColorSchemeSeven',
        label: 'Peak Scheme - Start Purple',
        colors: ['#9659da', '#ffdb21', '#ff3c82', '#73f692', '#041537', '#2a44d4', '#4a90e2', '#d0021b', '#f5a623', '#417505'],
    },
    {
        id: 'peakColorSchemeEight',
        label: 'Peak Scheme - Start Green',
        colors: ['#417505', '#d0021b', '#f5a623', '#ffdb21', '#9659da', '#ff3c82', '#73f692', '#041537', '#2a44d4', '#4a90e2'],
    },
    {
        id: 'peakColorSchemeNine',
        label: 'Peak Scheme - Start Light Blue',
        colors: ['#4a90e2', '#2a44d4', '#041537', '#9659da', '#73f692', '#ff3c82', '#ffdb21', '#417505', '#d0021b', '#f5a623'],
    },
    {
        id: 'peakColorSchemeTen',
        label: 'Peak Scheme - Start Yellow',
        colors: ['#ffdb21', '#73f692', '#9659da', '#ff3c82', '#2a44d4', '#4a90e2', '#041537', '#417505', '#d0021b', '#f5a623'],
    },

].map(s => new CategoricalScheme(s));

export default schemes;
