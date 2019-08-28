import createGetterFromChannelDef from '../../src/parsers/createGetterFromChannelDef';

describe('createGetterFromChannelDef(definition)', () => {
  it('handles ValueDef', () => {
    const getter = createGetterFromChannelDef({ value: 1 });
    expect(getter()).toBe(1);
  });
  it('handleFieldDef', () => {
    const getter = createGetterFromChannelDef({ field: 'cost' });
    expect(getter({ cost: 10 })).toBe(10);
  });
  it('handleFieldDef with nested field', () => {
    const getter = createGetterFromChannelDef({ field: 'fuel.cost' });
    expect(getter({ fuel: { cost: 10 } })).toBe(10);
  });
  it('otherwise return identity', () => {
    // @ts-ignore
    const getter = createGetterFromChannelDef({});
    expect(getter(300)).toBe(300);
  });
});
