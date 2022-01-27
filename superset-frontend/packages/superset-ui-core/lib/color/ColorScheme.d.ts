export interface ColorSchemeConfig {
    colors: string[];
    description?: string;
    id: string;
    label?: string;
    isDefault?: boolean;
}
export default class ColorScheme {
    colors: string[];
    description: string;
    id: string;
    label: string;
    isDefault?: boolean;
    constructor({ colors, description, id, label, isDefault, }: ColorSchemeConfig);
}
//# sourceMappingURL=ColorScheme.d.ts.map