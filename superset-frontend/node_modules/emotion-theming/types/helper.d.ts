import * as React from 'react'

export type PropsOf<
  C extends keyof JSX.IntrinsicElements | React.JSXElementConstructor<any>
> = JSX.LibraryManagedAttributes<C, React.ComponentPropsWithRef<C>>

export type Omit<T, U> = T extends any ? Pick<T, Exclude<keyof T, U>> : never
export type AddOptionalTo<T, U> = Omit<T, U> &
  Partial<Pick<T, Extract<keyof T, U>>>
