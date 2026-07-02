import { createSignal } from '@cairn/reactivity';
import { createWebHost } from '@cairn/platform-web';
import { mount, type Instance } from '@cairn/runtime';
import { BoxNode } from '@cairn/layout';
import type { Renderer } from '@cairn/host';
import { Box, Column, Row, Text } from '@cairn/primitives';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

const [count, setCount] = createSignal(0);
const [step, setStep] = createSignal(1);

// Local button helper (no Button primitive yet — Phase 10). Size lives on the Box
// (Row/Column can't be sized); the label is centered via Column(justify)>Row(justify),
// which fill the box's height/width because a Flex fills its main axis.
function Button(props: {
  label: string;
  width: number;
  height: number;
  bg: string;
  color: string;
  hoverBg?: string;
  font?: string;
  onClick: () => void;
}): Instance {
  return (
    <Box
      style={{
        width: props.width,
        height: props.height,
        backgroundColor: props.bg,
        borderRadius: 16,
        hover: props.hoverBg ? { backgroundColor: props.hoverBg } : {},
      }}
      onClick={props.onClick}
    >
      <Column style={{ justify: 'center', align: 'center' }}>
        <Row style={{ justify: 'center', align: 'center' }}>
          <Text style={{ font: props.font ?? '26px sans-serif', color: props.color }}>{props.label}</Text>
        </Row>
      </Column>
    </Box>
  ) as unknown as Instance;
}

// Bespoke slider: custom-painted track/fill/handle; value from the pointer position
// relative to the track (event.localX). Click-to-set + drag while pressed.
function Slider(props: {
  value: () => number;
  min: number;
  max: number;
  width: number;
  onChange: (v: number) => void;
}): Instance {
  const { value, min, max, width, onChange } = props;
  const layout = new BoxNode({ width, height: 24 });
  let dragging = false;
  const setFromLocal = (lx: number): void => {
    const c = Math.max(0, Math.min(width, lx));
    onChange(Math.round(min + (c / width) * (max - min)));
  };
  return {
    layout,
    children: [],
    handlers: {
      onPointerDown: (e) => {
        dragging = true;
        setFromLocal(e.localX ?? 0);
      },
      onPointerMove: (e) => {
        if (dragging) setFromLocal(e.localX ?? 0);
      },
      onPointerUp: () => {
        dragging = false;
      },
      onPointerLeave: () => {
        dragging = false;
      },
    },
    paintSelf(r: Renderer) {
      const w = layout.size.w;
      const h = layout.size.h;
      const cy = h / 2;
      const t = 4;
      const frac = (value() - min) / (max - min);
      const fx = frac * w;
      r.fillRoundRect({ x: 0, y: cy - t / 2, width: w, height: t }, t / 2, { color: '#3a3a3a' });
      r.fillRoundRect({ x: 0, y: cy - t / 2, width: fx, height: t }, t / 2, { color: '#e5e7eb' });
      const hr = 9;
      const hx = Math.max(hr, Math.min(w - hr, fx));
      r.fillRoundRect({ x: hx - hr, y: cy - hr, width: hr * 2, height: hr * 2 }, hr, { color: '#f5f5f5' });
    },
  };
}

function App() {
  return (
    <Column style={{ justify: 'center', align: 'center' }}>
      <Box style={{ width: 440, height: 384, padding: 28, backgroundColor: '#1b1b1d', borderRadius: 28 }}>
        <Column style={{ justify: 'center', align: 'center', gap: 16 }}>
          <Text style={{ font: 'bold 84px sans-serif', color: '#ffffff' }}>{() => String(count())}</Text>
          <Text style={{ font: '15px sans-serif', color: '#6b7280' }}>начни считать</Text>

          <Row style={{ gap: 12 }}>
            <Button
              label="−"
              width={120}
              height={68}
              bg="#2a2a2c"
              color="#e5e7eb"
              hoverBg="#333336"
              onClick={() => setCount(Math.max(0, count() - step()))}
            />
            <Button
              label="+"
              width={252}
              height={68}
              bg="#4577e6"
              color="#ffffff"
              hoverBg="#5482ea"
              onClick={() => setCount(count() + step())}
            />
          </Row>

          <Row style={{ gap: 14, align: 'center' }}>
            <Text style={{ font: '15px sans-serif', color: '#9ca3af' }}>Шаг</Text>
            <Slider value={step} min={1} max={10} width={286} onChange={setStep} />
            <Text style={{ font: 'bold 16px sans-serif', color: '#ffffff' }}>{() => String(step())}</Text>
          </Row>

          <Button
            label="↻  Сбросить"
            width={384}
            height={56}
            bg="#161618"
            color="#d1d5db"
            hoverBg="#202023"
            font="16px sans-serif"
            onClick={() => setCount(0)}
          />
        </Column>
      </Box>
    </Column>
  );
}

mount(App, host);
