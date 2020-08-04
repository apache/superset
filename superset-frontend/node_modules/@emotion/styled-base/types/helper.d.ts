import * as React from 'react'

/**
 * @desc Utility type for getting props type of React component.
 */
export type PropsOf<
  C extends keyof JSX.IntrinsicElements | React.JSXElementConstructor<any>
> = JSX.LibraryManagedAttributes<C, React.ComponentPropsWithRef<C>>

export type Omit<T, U> = T extends any ? Pick<T, Exclude<keyof T, U>> : never
export type Overwrapped<T, U> = Pick<T, Extract<keyof T, keyof U>>
