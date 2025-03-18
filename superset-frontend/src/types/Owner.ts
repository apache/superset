// DODO was here

/**
 * The Owner model as returned from the API
 */

// DODO added 44211759
interface OwnerDodoExtened {
  email?: string;
  country_name?: string;
}
export default interface Owner extends OwnerDodoExtened {
  first_name?: string;
  id: number;
  last_name?: string;
  full_name?: string;
}
