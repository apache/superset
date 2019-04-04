"use strict";

const submittableLocalNames = new Set(["button", "input", "keygen", "object", "select", "textarea"]);

exports.isDisabled = formControl => {
  if (formControl.localName === "button" || formControl.localName === "input" || formControl.localName === "select" ||
      formControl.localName === "textarea") {
    if (formControl.hasAttribute("disabled")) {
      return true;
    }
  }

  let e = formControl.parentNode;
  while (e) {
    if (e.localName === "fieldset" && e.hasAttribute("disabled")) {
      const firstLegendElementChild = e.querySelector("legend");
      if (!firstLegendElementChild || !firstLegendElementChild.contains(formControl)) {
        return true;
      }
    }
    e = e.parentNode;
  }

  return false;
};

exports.isSubmittable = formControl => {
  // https://html.spec.whatwg.org/multipage/forms.html#category-submit
  return submittableLocalNames.has(formControl.localName);
};

exports.isButton = formControl => {
  // https://html.spec.whatwg.org/multipage/forms.html#concept-button
  return formControl.type === "button" || formControl.type === "submit" || formControl.type === "reset" ||
         formControl.type === "image" || formControl.localName === "button";
};

exports.normalizeToCRLF = string => {
  return string.replace(/\r([^\n])/g, "\r\n$1")
               .replace(/\r$/, "\r\n")
               .replace(/([^\r])\n/g, "$1\r\n")
               .replace(/^\n/, "\r\n");
};
