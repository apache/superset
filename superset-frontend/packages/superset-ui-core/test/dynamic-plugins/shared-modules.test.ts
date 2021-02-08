import { defineSharedModule, defineSharedModules, reset } from '../../src';

describe('shared modules', () => {
  afterEach(() => {
    reset();
  });

  it('assigns to window', async () => {
    const fakeModule = { foo: 'bar' };
    const fetchModule = jest.fn().mockResolvedValue(fakeModule);

    await defineSharedModule('test-module', fetchModule);

    expect((window as any)['__superset__/test-module']).toStrictEqual(fakeModule);
  });

  it('resolves to the same reference every time', async () => {
    const fakeModule = { foo: 'bar' };
    const fetchModule = jest.fn().mockResolvedValue(fakeModule);

    const result1 = await defineSharedModule('test-module', fetchModule);
    const result2 = await defineSharedModule('test-module', fetchModule);

    expect(result1).toStrictEqual(fakeModule);
    expect(result2).toStrictEqual(fakeModule);
  });

  it('does not redefine unnecessarily', async () => {
    const fakeModule = { foo: 'bar' };
    const fetchModule = jest.fn().mockResolvedValue(fakeModule);
    const duplicateFetchModule = jest.fn().mockResolvedValue(fakeModule);

    const result1 = await defineSharedModule('test-module', fetchModule);
    const result2 = await defineSharedModule('test-module', duplicateFetchModule);

    expect(result1).toStrictEqual(fakeModule);
    expect(result2).toStrictEqual(fakeModule);
    expect(duplicateFetchModule).not.toHaveBeenCalled();
  });

  it('deduplicates in-progress definitions', async () => {
    const fakeModule = { foo: 'bar' };
    // get a promise that actually takes a moment;
    const fetchModule = jest
      .fn()
      .mockImplementation(() => Promise.resolve(setImmediate).then(() => fakeModule));

    const promise1 = defineSharedModule('test-module', fetchModule);
    const promise2 = defineSharedModule('test-module', fetchModule);
    const [result1, result2] = await Promise.all([promise1, promise2]);

    expect(fetchModule).toHaveBeenCalledTimes(1);
    expect(result1).toStrictEqual(result2);
  });

  it('shares a map of modules', async () => {
    const foo = { foo: 'bar' };
    const fizz = { fizz: 'buzz' };
    await defineSharedModules({
      'module-foo': async () => foo,
      'module-fizz': async () => fizz,
    });

    expect((window as any)['__superset__/module-foo']).toEqual(foo);
    expect((window as any)['__superset__/module-fizz']).toEqual(fizz);
  });
});
