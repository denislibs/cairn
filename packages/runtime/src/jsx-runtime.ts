// Automatic JSX runtime. Every element is a function (primitive or user component),
// so jsx simply calls it with props. There are no lowercase host tags.
export function jsx(type: (props: any) => any, props: any): any {
  return type(props);
}

export const jsxs = jsx;

export function Fragment(props: { children?: any }): any {
  return props.children;
}
