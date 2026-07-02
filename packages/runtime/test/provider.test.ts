import { test, expect } from 'vitest';
import { BoxNode } from '@cairn/layout';
import { createContext, useContext } from '@cairn/reactivity';
import { Provider, type Instance } from '../src/index';

const Ctx = createContext('default');

function leaf(): Instance {
  return { layout: new BoxNode({ width: 1, height: 1 }), children: [], paintSelf() {} };
}

test('Provider exposes its value to useContext inside the children thunk', () => {
  let seen = '';
  const child = () => {
    seen = useContext(Ctx);
    return leaf();
  };
  const inst = Provider({ context: Ctx, value: 'provided', children: child });
  expect(seen).toBe('provided');
  expect(inst.layout).toBeInstanceOf(BoxNode);
});

test('useContext outside any provider returns the default', () => {
  expect(useContext(Ctx)).toBe('default');
});

test('Provider value is scoped: reading after Provider returns the default again', () => {
  Provider({ context: Ctx, value: 'scoped', children: () => leaf() });
  expect(useContext(Ctx)).toBe('default');
});
