import ExtensibleFunction from '../../src/models/ExtensibleFunction';

describe('ExtensibleFunction', () => {
  class Func1 extends ExtensibleFunction {
    constructor(x) {
      super(() => x); // closure
    }
  }
  class Func2 extends ExtensibleFunction {
    constructor(x) {
      super(() => this.x); // arrow function, refer to its own field
      this.x = x;
    }

    hi() {
      return 'hi';
    }
  }
  class Func3 extends ExtensibleFunction {
    constructor(x) {
      super(function customName() {
        return customName.x;
      }); // named function
      this.x = x;
    }
  }

  it('its subclass is an instance of Function', () => {
    expect(Func1).toBeInstanceOf(Function);
    expect(Func2).toBeInstanceOf(Function);
    expect(Func3).toBeInstanceOf(Function);
  });

  const func1 = new Func1(100);
  const func2 = new Func2(100);
  const func3 = new Func3(100);

  it('an instance of its subclass is executable like regular function', () => {
    expect(func1()).toEqual(100);
    expect(func2()).toEqual(100);
    expect(func3()).toEqual(100);
  });

  it('its subclass behaves like regular class with its own fields and functions', () => {
    expect(func2.x).toEqual(100);
    expect(func2.hi()).toEqual('hi');
  });

  it('its subclass can set name by passing named function to its constructor', () => {
    expect(func3.name).toEqual('customName');
  });
});
