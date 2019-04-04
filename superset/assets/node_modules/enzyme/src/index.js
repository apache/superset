import ReactWrapper from './ReactWrapper';
import ShallowWrapper from './ShallowWrapper';
import EnzymeAdapter from './EnzymeAdapter';

import mount from './mount';
import shallow from './shallow';
import render from './render';
import { merge as configure } from './configuration';

module.exports = {
  render,
  shallow,
  mount,
  ShallowWrapper,
  ReactWrapper,
  configure,
  EnzymeAdapter,
};
