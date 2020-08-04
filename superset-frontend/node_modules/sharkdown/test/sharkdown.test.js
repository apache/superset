var sharkdown = require('../'),
    spigot = require('stream-spigot'),
    expect = require('expect.js');

process.stdout.write('\\e[test\\e[0m');
describe('sharkdown', function() {
    describe('string', function() {
        it('formats a string', function() {
            expect(sharkdown('# test')).to.eql('\x1B[1mtest\x1B[22m');
        });
    });

    describe('stream', function() {
        it('formats a header', function(done) {
            spigot(['# test']).pipe(sharkdown())
                .on('data', function(d) {
                    expect(d).to.eql('\x1B[1mtest\x1B[22m\n');
                    done();
                });
        });
        it('formats code', function(done) {
            spigot(['this is `source code`']).pipe(sharkdown())
                .on('data', function(d) {
                    expect(d).to.eql('this is \x1B[36msource code\x1B[39m\n');
                    done();
                });
        });
        it('formats bold', function(done) {
            spigot(['this is **bold**']).pipe(sharkdown())
                .on('data', function(d) {
                    expect(d).to.eql('this is \x1B[1mbold\x1B[22m\n');
                    done();
                });
        });
        it('formats __', function(done) {
            spigot(['this is __emph__']).pipe(sharkdown())
                .on('data', function(d) {
                    expect(d).to.eql('this is \x1B[3memph\x1B[23m\n');
                    done();
                });
        });
        it('formats *mid*', function(done) {
            spigot(['this is *mid*']).pipe(sharkdown())
                .on('data', function(d) {
                    expect(d).to.eql('this is \x1B[90mmid\x1B[39m\n');
                    done();
                });
        });
    });
});
