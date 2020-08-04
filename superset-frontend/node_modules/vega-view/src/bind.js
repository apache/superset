import element from './element';
import {debounce} from 'vega-util';
import {tickStep} from 'd3-array';

const BindClass = 'vega-bind',
      NameClass = 'vega-bind-name',
      RadioClass = 'vega-bind-radio';

/**
 * Bind a signal to an external HTML input element. The resulting two-way
 * binding will propagate input changes to signals, and propagate signal
 * changes to the input element state. If this view instance has no parent
 * element, we assume the view is headless and no bindings are created.
 * @param {Element|string} el - The parent DOM element to which the input
 *   element should be appended as a child. If string-valued, this argument
 *   will be treated as a CSS selector. If null or undefined, the parent
 *   element of this view will be used as the element.
 * @param {object} param - The binding parameters which specify the signal
 *   to bind to, the input element type, and type-specific configuration.
 * @return {View} - This view instance.
 */
export default function(view, el, binding) {
  if (!el) return;

  const param = binding.param;
  let bind = binding.state;

  if (!bind) {
    bind = binding.state = {
      elements: null,
      active: false,
      set: null,
      update: value => {
        if (value !== view.signal(param.signal)) {
          view.runAsync(null, function() {
            bind.source = true;
            view.signal(param.signal, value);
          });
        }
      }
    };
    if (param.debounce) {
      bind.update = debounce(param.debounce, bind.update);
    }
  }

  generate(bind, el, param, view.signal(param.signal));

  if (!bind.active) {
    view.on(view._signals[param.signal], null, () => {
      bind.source
        ? (bind.source = false)
        : bind.set(view.signal(param.signal));
    });
    bind.active = true;
  }

  return bind;
}

/**
 * Generate an HTML input form element and bind it to a signal.
 */
function generate(bind, el, param, value) {
  const div = element('div', {'class': BindClass});

  const wrapper = param.input === 'radio'
    ? div
    : div.appendChild(element('label'));

  wrapper.appendChild(element('span',
    {'class': NameClass},
    (param.name || param.signal)
  ));

  el.appendChild(div);

  let input = form;
  switch (param.input) {
    case 'checkbox': input = checkbox; break;
    case 'select':   input = select; break;
    case 'radio':    input = radio; break;
    case 'range':    input = range; break;
  }

  input(bind, wrapper, param, value);
}

/**
 * Generates an arbitrary input form element.
 * The input type is controlled via user-provided parameters.
 */
function form(bind, el, param, value) {
  const node = element('input');

  for (const key in param) {
    if (key !== 'signal' && key !== 'element') {
      node.setAttribute(key === 'input' ? 'type' : key, param[key]);
    }
  }
  node.setAttribute('name', param.signal);
  node.value = value;

  el.appendChild(node);
  node.addEventListener('input', () => bind.update(node.value));

  bind.elements = [node];
  bind.set = value => node.value = value;
}

/**
 * Generates a checkbox input element.
 */
function checkbox(bind, el, param, value) {
  const attr = {type: 'checkbox', name: param.signal};
  if (value) attr.checked = true;
  const node = element('input', attr);

  el.appendChild(node);
  node.addEventListener('change', () => bind.update(node.checked));

  bind.elements = [node];
  bind.set = value => node.checked = !!value || null;
}

/**
 * Generates a selection list input element.
 */
function select(bind, el, param, value) {
  const node = element('select', {name: param.signal}),
        labels = param.labels || [];

  param.options.forEach((option, i) => {
    const attr = {value: option};
    if (valuesEqual(option, value)) attr.selected = true;
    node.appendChild(element('option', attr, (labels[i] || option)+''));
  });

  el.appendChild(node);

  node.addEventListener('change', () => {
    bind.update(param.options[node.selectedIndex]);
  });

  bind.elements = [node];
  bind.set = value => {
    for (let i = 0, n = param.options.length; i < n; ++i) {
      if (valuesEqual(param.options[i], value)) {
        node.selectedIndex = i; return;
      }
    }
  };
}

/**
 * Generates a radio button group.
 */
function radio(bind, el, param, value) {
  const group = element('span', {'class': RadioClass}),
        labels = param.labels || [];

  el.appendChild(group);

  bind.elements = param.options.map((option, i) => {
    const attr = {
      type:  'radio',
      name:  param.signal,
      value: option
    };
    if (valuesEqual(option, value)) attr.checked = true;

    const input = element('input', attr);
    input.addEventListener('change', () => bind.update(option));

    const label = element('label', {}, (labels[i] || option)+'');
    label.prepend(input);
    group.appendChild(label);

    return input;
  });

  bind.set = value => {
    const nodes = bind.elements,
          n = nodes.length;
    for (let i = 0; i < n; ++i) {
      if (valuesEqual(nodes[i].value, value)) nodes[i].checked = true;
    }
  };
}

/**
 * Generates a slider input element.
 */
function range(bind, el, param, value) {
  value = value !== undefined ? value : ((+param.max) + (+param.min)) / 2;

  const max = param.max != null ? param.max : Math.max(100, +value) || 100,
        min = param.min || Math.min(0, max, +value) || 0,
        step = param.step || tickStep(min, max, 100);

  const node = element('input', {
    type:  'range',
    name:  param.signal,
    min:   min,
    max:   max,
    step:  step
  });
  node.value = value;

  const span = element('span', {}, +value);

  el.appendChild(node);
  el.appendChild(span);

  const update = () => {
    span.textContent = node.value;
    bind.update(+node.value);
  };

  // subscribe to both input and change
  node.addEventListener('input', update);
  node.addEventListener('change', update);

  bind.elements = [node];
  bind.set = value => {
    node.value = value;
    span.textContent = value;
  };
}

function valuesEqual(a, b) {
  return a === b || (a+'' === b+'');
}
