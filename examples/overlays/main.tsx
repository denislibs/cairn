import { createSignal } from '@cairn/reactivity';
import { createWebHost } from '@cairn/platform-web';
import { mount } from '@cairn/runtime';
import { Box, Column, Row, Text } from '@cairn/primitives';
import { StyleSheet } from '@cairn/style';
import { Button, Modal, Tooltip, Popover } from '@cairn/widgets';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const host = createWebHost(canvas);

const [modalOpen, setModalOpen] = createSignal(false);

const s = StyleSheet.create({
  root: { justify: 'center', align: 'center' },
  card: {
    width: 520,
    padding: 36,
    borderRadius: 28,
    backgroundGradient: {
      kind: 'linear',
      from: { x: 0, y: 0 },
      to: { x: 0, y: 400 },
      stops: [
        { offset: 0, color: '#222226' },
        { offset: 1, color: '#18181b' },
      ],
    },
    backgroundColor: '#1b1b1d',
    boxShadow: { color: '#0007', blur: 36, offsetX: 0, offsetY: 14 },
  },
  cardInner: { gap: 28, align: 'center' },
  title: { font: 'bold 22px sans-serif', color: '#ffffff' },
  section: { gap: 10, align: 'center' },
  label: { font: '13px sans-serif', color: '#6b7280' },
  // Modal content panel
  modalPanel: {
    width: 360,
    padding: 28,
    borderRadius: 20,
    backgroundColor: '#28282c',
    boxShadow: { color: '#0008', blur: 40, offsetX: 0, offsetY: 16 },
  },
  modalPanelInner: { gap: 20, align: 'center' },
  modalTitle: { font: 'bold 18px sans-serif', color: '#ffffff' },
  modalBody: { font: '14px sans-serif', color: '#9ca3af' },
  // Tooltip bubble
  tooltipBubble: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#111113',
    border: { width: 1, color: '#2a2a2e' },
    boxShadow: { color: '#0006', blur: 12, offsetX: 0, offsetY: 4 },
  },
  tooltipText: { font: '13px sans-serif', color: '#e5e7eb' },
  // Popover menu
  popoverMenu: {
    width: 180,
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#28282c',
    border: { width: 1, color: '#3a3a3e' },
    boxShadow: { color: '#0007', blur: 20, offsetX: 0, offsetY: 8 },
  },
  popoverMenuInner: { gap: 4 },
  menuItem: {
    width: 164,
    padding: 10,
    borderRadius: 8,
    hover: { backgroundColor: '#333336' },
  },
  menuItemText: { font: '14px sans-serif', color: '#d1d5db' },
});

// Modal inner content — built once; Show will mount/unmount it reactively
function ModalContent() {
  return (
    <Box style={s.modalPanel}>
      <Column style={s.modalPanelInner} mainAxisSize="min">
        <Text style={s.modalTitle}>Диалоговое окно</Text>
        <Text style={s.modalBody}>Это Modal поверх основного контента.</Text>
        <Button
          label="Закрыть"
          variant="secondary"
          style={{ width: 160 }}
          onClick={() => setModalOpen(false)}
        />
      </Column>
    </Box>
  );
}

function TooltipContent() {
  return (
    <Box style={s.tooltipBubble}>
      <Text style={s.tooltipText}>Подсказка!</Text>
    </Box>
  );
}

function PopoverContent() {
  return (
    <Box style={s.popoverMenu}>
      <Column style={s.popoverMenuInner} mainAxisSize="min">
        <Box style={s.menuItem}>
          <Text style={s.menuItemText}>Профиль</Text>
        </Box>
        <Box style={s.menuItem}>
          <Text style={s.menuItemText}>Настройки</Text>
        </Box>
        <Box style={s.menuItem}>
          <Text style={s.menuItemText}>Выйти</Text>
        </Box>
      </Column>
    </Box>
  );
}

function App() {
  return (
    <Column style={s.root}>
      <Box style={s.card}>
        <Column style={s.cardInner} mainAxisSize="min">
          <Text style={s.title}>Оверлеи</Text>

          {/* ── Modal demo ─────────────────────────────────────── */}
          <Column style={s.section} mainAxisSize="min">
            <Text style={s.label}>Modal</Text>
            <Button
              label="Открыть модалку"
              variant="primary"
              style={{ width: 200 }}
              onClick={() => setModalOpen(true)}
            />
          </Column>

          {/* ── Tooltip demo ────────────────────────────────────── */}
          <Column style={s.section} mainAxisSize="min">
            <Text style={s.label}>Tooltip</Text>
            <Tooltip content={<TooltipContent />} side="top">
              <Button label="Наведи на меня" variant="secondary" style={{ width: 200 }} />
            </Tooltip>
          </Column>

          {/* ── Popover demo ────────────────────────────────────── */}
          <Column style={s.section} mainAxisSize="min">
            <Text style={s.label}>Popover</Text>
            <Popover content={<PopoverContent />} side="bottom">
              <Button label="Меню" variant="ghost" style={{ width: 200, border: { width: 1, color: '#3a3a3e' } }} />
            </Popover>
          </Column>
        </Column>
      </Box>

      {/* Modal renders via Portal on the overlay layer */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <ModalContent />
      </Modal>
    </Column>
  );
}

mount(App, host);
