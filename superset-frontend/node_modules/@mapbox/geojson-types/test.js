const fs = require('fs');
const tape = require('tape');
const exec = require('child_process').exec;

tape('valid', (t) => {
    exec(`npx flow focus-check ${__dirname}/fixtures/valid/*.js.flow`, (err) => {
        t.error(err);
        t.end();
    });
});

tape('invalid', (t) => {
    const fixtures = fs.readdirSync(`${__dirname}/fixtures/invalid`);
    for (const file of fixtures) {
        t.test(file, (t) => {
            exec(`npx flow focus-check ${__dirname}/fixtures/invalid/${file}`, (err) => {
                t.ok(err, 'nonzero exit for invalid fixture');
                t.end();
            });
        });
    }

    t.end();
});

