import { addDecorator } from '@storybook/react';
import { jsxDecorator } from 'storybook-addon-jsx';
import themeDecorator from './themeDecorator';

addDecorator(jsxDecorator);
// addDecorator(themeDecorator);