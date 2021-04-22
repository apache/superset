const bootstrap = JSON.parse(
  document.getElementById('app').getAttribute('data-bootstrap'),
);

// Replace values in Filter and Dashboard
export default function replaceTemplate(x) {
  const templates = {
    '{email}': bootstrap.user.email,
    '{username}': bootstrap.user.username,
    '{firstName}': bootstrap.user.firstName,
    '{lastName}': bootstrap.user.lastName,
  };
  if (x in templates) {
    return templates[x];
  }
  return x;
}
