import ExtensibleFunction from '../../src/models/ExtensibleFunction';

describe('ExtensibleFunction', () => {
  class Func1 extends ExtensibleFunction {
    constructor(x: any) {
      super(() => x); // closure
    }
  }
  class Func2 extends ExtensibleFunction {
    x: any;

    constructor(x: any) {
      super(() => this.x); // arrow function, refer to its own field
      this.x = x;
    }

    // eslint-disable-next-line class-methods-use-this
    hi() {
      return 'hi';
    }
  }

  it('its subclass is an instance of Function', () => {
    expect(Func1).toBeInstanceOf(Function);
    expect(Func2).toBeInstanceOf(Function);
  });

  const func1 = new Func1(100);
  const func2 = new Func2(100);

  it('an instance of its subclass is executable like regular function', () => {
    expect(func1()).toEqual(100);
    expect(func2()).toEqual(100);
  });

  it('its subclass behaves like regular class with its own fields and functions', () => {
    expect(func2.x).toEqual(100);
    expect(func2.hi()).toEqual('hi');
  });
});
