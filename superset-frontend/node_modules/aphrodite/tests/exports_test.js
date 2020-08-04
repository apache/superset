import { assert } from 'chai';

import { initialHashFn } from '../src/exports';

describe('initialHashFn()', () => {
    it('does not minify in development', () => {
        const hashFn = initialHashFn();
        const key = 'key';

        const result = hashFn('test', key);
        assert.isOk(result.startsWith(`${key}_`));
    });

    describe('process.env.NODE_ENV === \'production\'', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'production';
        });

        afterEach(() => {
            delete process.env.NODE_ENV;
        });

        it('minifies', () => {
            const hashFn = initialHashFn();
            const key = 'key';

            const result = hashFn('test', key);
            assert.isNotOk(result.startsWith(`${key}_`));
        });
    })
});
