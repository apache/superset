export default function isRequired(field) {
  throw new Error(`${field} is required.`);
}
