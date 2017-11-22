import { it, describe } from 'mocha';
import { expect } from 'chai';

import { unitToRadius } from '../../../javascripts/modules/geo';

const METER_TO_MILE = 1609.34;

describe('unitToRadius', () => {
  it('converts to square meters', () => {
    expect(unitToRadius('square_m', 4 * Math.PI)).to.equal(2);
  });
  it('converts to square meters', () => {
    expect(unitToRadius('square_km', 25 * Math.PI)).to.equal(5000);
  });
  it('converts to radius meters', () => {
    expect(unitToRadius('radius_m', 1000)).to.equal(1000);
  });
  it('converts to radius km', () => {
    expect(unitToRadius('radius_km', 1)).to.equal(1000);
  });
  it('converts to radius miles', () => {
    expect(unitToRadius('radius_miles', 1)).to.equal(METER_TO_MILE);
  });
  it('converts to square miles', () => {
    expect(unitToRadius('square_miles', 25 * Math.PI)).to.equal(5000 * (METER_TO_MILE / 1000));
  });
});
