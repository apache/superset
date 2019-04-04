import webpack = require('webpack');

export interface Bundle {
    id: string;
    name: string | null;
    file: string;
    publicPath: string;
}

export interface Manifest {
    [moduleId: string]: Bundle[];
}

export interface ReactLoadablePluginOptions {
    filename: string;
}

export class ReactLoadablePlugin extends webpack.Plugin {
    constructor(opts?: ReactLoadablePluginOptions);
}

export function getBundles(manifest: Manifest, moduleIds: string[]): Bundle[];
