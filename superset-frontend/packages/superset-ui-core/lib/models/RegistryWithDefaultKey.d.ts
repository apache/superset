import Registry, { RegistryConfig } from './Registry';
interface RegistryWithDefaultKeyConfig extends RegistryConfig {
    initialDefaultKey?: string;
    setFirstItemAsDefault?: boolean;
}
export default class RegistryWithDefaultKey<V, W extends V | Promise<V> = V | Promise<V>> extends Registry<V, W> {
    initialDefaultKey?: string;
    defaultKey?: string;
    setFirstItemAsDefault: boolean;
    constructor(config?: RegistryWithDefaultKeyConfig);
    clear(): this;
    get(key?: string): V | W | undefined;
    registerValue(key: string, value: V): this;
    registerLoader(key: string, loader: () => W): this;
    getDefaultKey(): string | undefined;
    setDefaultKey(key: string): this;
    clearDefaultKey(): this;
}
export {};
//# sourceMappingURL=RegistryWithDefaultKey.d.ts.map