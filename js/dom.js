/** Create an element: h('a', { class: 'chip', href: '#/' }, 'Label', childElement). */
export function h(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === false || value == null) continue;
    element.setAttribute(name, value === true ? '' : value);
  }
  element.append(...children.flat().filter((child) => child != null && child !== false));
  return element;
}
