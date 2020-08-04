export declare type Handler = (...args: any[]) => any;
declare function useUncontrolledProp<TProp, THandler extends Handler = Handler>(propValue: TProp | undefined, defaultValue: TProp, handler?: THandler): readonly [TProp, THandler];
declare function useUncontrolledProp<TProp, THandler extends Handler = Handler>(propValue: TProp | undefined, defaultValue?: TProp | undefined, handler?: THandler): readonly [TProp | undefined, THandler];
export { useUncontrolledProp };
declare type FilterFlags<Base, Condition> = {
    [Key in keyof Base]: NonNullable<Base[Key]> extends Condition ? Key : never;
};
declare type AllowedNames<Base, Condition> = FilterFlags<Base, Condition>[keyof Base];
declare type ConfigMap<TProps extends object> = {
    [p in keyof TProps]?: AllowedNames<TProps, Function>;
};
export default function useUncontrolled<TProps extends object, TDefaults extends string = never>(props: TProps, config: ConfigMap<TProps>): Omit<TProps, TDefaults>;
