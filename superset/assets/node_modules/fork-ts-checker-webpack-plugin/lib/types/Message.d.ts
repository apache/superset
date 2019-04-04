import { NormalizedMessage } from './NormalizedMessage';
export interface Message {
    diagnostics: NormalizedMessage[];
    lints: NormalizedMessage[];
}
