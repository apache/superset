import {assert} from 'chai';
import spawn from 'cross-spawn'

describe('Typings', () => {
    it('compiles successfully', () => {
        const typescriptCompilation = spawn.sync('./node_modules/.bin/tsc', [
            '-p',
            './tsconfig.json',
        ]);
        const output = typescriptCompilation.stdout.toString();

        assert.equal(output, '');
        assert.equal(typescriptCompilation.status, 0);
    }).timeout(10000);
});
