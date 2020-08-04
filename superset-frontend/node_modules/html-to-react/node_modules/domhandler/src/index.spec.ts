import { readdirSync } from "fs";
import { resolve } from "path";
import { Parser } from "htmlparser2";
import Handler, { Node } from ".";

const basePath = resolve(__dirname, "__fixtures__");

describe("DomHandler", () => {
    readdirSync(basePath)
        .filter(name => name.endsWith(".json")) // Only allow .json files
        .map(name => resolve(basePath, name))
        .map(require)
        .forEach(fixture =>
            test(fixture.name, () => {
                const { expected, html: data } = fixture;

                const handler = new Handler(
                    (err: Error | null, actual: Node[]) => {
                        expect(err).toBeNull();
                        compare(actual, expected);
                    },
                    fixture.options
                );

                const parser = new Parser(handler, fixture.options);

                // First, try to run the fixture via chunks
                if (fixture.streaming || fixture.streaming === undefined) {
                    for (let i = 0; i < data.length; i++) {
                        parser.write(data.charAt(i));
                    }

                    parser.done();
                }

                // Then parse everything
                parser.parseComplete(data);
            })
        );
});

function compare<T>(actual: T, expected: T) {
    expect(typeof actual).toBe(typeof expected);
    if (typeof expected !== "object" || expected === null) {
        expect(actual).toBe(expected);
    } else {
        for (const prop in expected) {
            expect(prop in actual).toBeTruthy();
            compare(actual[prop], expected[prop]);
        }
    }
}
