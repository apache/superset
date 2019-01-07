export default function isRequired(field: string): never {
  throw new Error(`${field} is required.`);
}
