import Plugin from './Plugin';
export default class Preset {
    name: string;
    description: string;
    presets: Preset[];
    plugins: Plugin[];
    constructor(config?: {
        name?: string;
        description?: string;
        presets?: Preset[];
        plugins?: Plugin[];
    });
    register(): this;
}
//# sourceMappingURL=Preset.d.ts.map