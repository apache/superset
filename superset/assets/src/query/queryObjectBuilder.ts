import { FormData } from './formData';

// TODO: fill out the rest of the query object
export interface QueryObject {
  groupby: string[];
}

export default function build(formData: FormData): QueryObject[] {
  return [{
    groupby: formData.groupby! || [],
  }];
}
