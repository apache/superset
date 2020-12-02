import { ExtraFormData } from '../../query';

export type HandlerFunction = (...args: unknown[]) => void;

export type SetExtraFormDataHook = {
  (extraFormData: ExtraFormData): void;
};

export interface PlainObject {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}
