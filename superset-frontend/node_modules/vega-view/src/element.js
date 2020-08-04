export default function(tag, attr, text) {
  var el = document.createElement(tag);
  for (var key in attr) el.setAttribute(key, attr[key]);
  if (text != null) el.textContent = text;
  return el;
}
