import { minify } from "../lib/minify";

export function default_options() {
    const defs = {};

    Object.keys(infer_options({ 0: 0 })).forEach((component) => {
        const options = infer_options({
            [component]: {0: 0}
        });

        if (options) defs[component] = options;
    });
    return defs;
}

function infer_options(options) {
    var result = minify("", options);
    return result.error && result.error.defs;
}
