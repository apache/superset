import { expect } from 'chai';
import { describe, it } from 'mocha';
import renderEventFlow from '../../../visualizations/EventFlow';

describe('renderEventFlow', () => {
  it('should be defined', () => {
    expect(renderEventFlow).to.be.a('function');
  });
});
