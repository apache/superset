import interrupt from "../interrupt";

export default function(name) {
  return this.each(function() {
    interrupt(this, name);
  });
}
