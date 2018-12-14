export default function isRequired(field: string) {
  throw new Error(`${field} is required.`);
}
