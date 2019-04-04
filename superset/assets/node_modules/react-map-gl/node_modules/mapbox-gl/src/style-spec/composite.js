
export default function (style) {
    const styleIDs = [];
    const sourceIDs = [];
    const compositedSourceLayers = [];

    for (const id in style.sources) {
        const source = style.sources[id];

        if (source.type !== "vector")
            continue;

        const match = /^mapbox:\/\/(.*)/.exec(source.url);
        if (!match)
            continue;

        styleIDs.push(id);
        sourceIDs.push(match[1]);
    }

    if (styleIDs.length < 2)
        return style;

    styleIDs.forEach((id) => {
        delete style.sources[id];
    });

    const compositeID = sourceIDs.join(",");

    style.sources[compositeID] = {
        "type": "vector",
        "url": `mapbox://${compositeID}`
    };

    style.layers.forEach((layer) => {
        if (styleIDs.indexOf(layer.source) >= 0) {
            layer.source = compositeID;

            if ('source-layer' in layer) {
                if (compositedSourceLayers.indexOf(layer['source-layer']) >= 0) {
                    throw new Error('Conflicting source layer names');
                } else {
                    compositedSourceLayers.push(layer['source-layer']);
                }
            }
        }
    });

    return style;
}
