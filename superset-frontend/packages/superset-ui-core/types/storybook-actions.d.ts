declare module 'storybook/actions' {
  export function action(name: string): (...args: unknown[]) => void;
}
