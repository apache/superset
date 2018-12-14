import ExtensibleFunction from '../../src/models/ExtensibleFunction';

describe('ExtensibleFunction', () => {
  class Func3 extends ExtensibleFunction {
    constructor(x) {
      super(function customName() {
        return customName.x;
      }); // named function
      this.x = x;
    }
  }

  it('its subclass is an instance of Function', () => {
    expect(Func3).toBeInstanceOf(Function);
  });

  const func3 = new Func3(100);

  it('its subclass can set name by passing named function to its constructor', () => {
    expect(func3.name).toEqual('customName');
  });
});
