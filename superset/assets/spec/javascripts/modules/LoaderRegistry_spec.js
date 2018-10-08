// import { describe, it } from 'mocha';
// import { expect } from 'chai';
// import LoaderRegistry from '../../../src/modules/LoaderRegistry';

// describe('LoaderRegistry', () => {
//   it('exists', () => {
//     expect(LoaderRegistry !== undefined).to.equal(true);
//   });

//   describe('new LoaderRegistry(name)', () => {
//     it('can create a new registry when name is not given', () => {
//       const registry = new LoaderRegistry();
//       expect(registry).to.be.instanceOf(LoaderRegistry);
//     });
//     it('can create a new registry when name is given', () => {
//       const registry = new LoaderRegistry('abc');
//       expect(registry).to.be.instanceOf(LoaderRegistry);
//       expect(registry.name).to.equal('abc');
//     });
//   });
//   describe('.has(key)', () => {
//     it('returns true if an item with the given key exists', () => {
//       const registry = new LoaderRegistry();
//       registry.register('a', 'testValue');
//       expect(registry.has('a')).to.equal(true);
//     });
//     it('returns false if an item with the given key does not exist', () => {
//       const registry = new LoaderRegistry();
//       expect(registry.has('a')).to.equal(false);
//     });
//   });
//   describe('.register(key, value)', () => {
//     it('registers the given value with the given key and wraps it as a function that returns the value', () => {
//       const registry = new LoaderRegistry();
//       registry.register('a', 'testValue');
//       expect(registry.has('a')).to.equal(true);
//       expect(registry.get('a')).to.a('Function');
//     });
//     it('returns the registry itself', () => {
//       const registry = new LoaderRegistry();
//       expect(registry.register('a', 'testValue')).to.equal(registry);
//     });
//   });
//   describe('.registerLoader(key, loader)', () => {
//     it('registers the given loader with the given key', () => {
//       const registry = new LoaderRegistry();
//       registry.registerLoader('a', () => 'testValue');
//       expect(registry.has('a')).to.equal(true);
//       expect(registry.get('a')).to.a('Function');
//     });
//     it('returns the registry itself', () => {
//       const registry = new LoaderRegistry();
//       expect(registry.registerLoader('a', () => 'testValue')).to.equal(registry);
//     });
//   });
//   describe('.get(key)', () => {
//     it('returns the loader given the key', () => {
//       const registry = new LoaderRegistry();
//       registry.register('a', 'testValue');
//       expect(registry.get('a')).to.be.a('Function');
//     });
//     it('returns null if the loader with specified key does not exist', () => {
//       const registry = new LoaderRegistry();
//       expect(registry.get('a')).to.equal(null);
//     });
//     it('If the key was registered multiple times, returns the most recent loader.', () => {
//       const registry = new LoaderRegistry();
//       registry.register('a', 'testValue');
//       expect(registry.get('a')()).to.equal('testValue');
//       registry.register('a', 'newValue');
//       expect(registry.get('a')()).to.equal('newValue');
//     });
//   });
//   describe('.load(key)', () => {
//     it('returns a promise of item given the key', () => {
//       const registry = new LoaderRegistry();
//       registry.register('a', 'testValue');
//       return registry.load('a').then((value) => {
//         expect(value).to.equal('testValue');
//       });
//     });
//     it('returns a rejected promise if the item with specified key does not exist', () => {
//       const registry = new LoaderRegistry();
//       return registry.load('a').then(null, (err) => {
//         expect(err).to.equal('Item with key "a" is not registered.');
//       });
//     });
//     it('If the key was registered multiple times, returns a promise of the most recent value.', () => {
//       const registry = new LoaderRegistry();
//       registry.register('a', 'testValue');
//       const promise1 = registry.load('a').then((value) => {
//         expect(value).to.equal('testValue');
//       });
//       registry.register('a', 'newValue');
//       const promise2 = registry.load('a').then((value) => {
//         expect(value).to.equal('newValue');
//       });
//       return Promise.all([promise1, promise2]);
//     });
//   });
// });
