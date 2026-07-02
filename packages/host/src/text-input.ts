/** A snapshot of the text being edited, including the selection range. */
export interface TextEditingValue {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

/** Framework-side callbacks driven by the platform text-input proxy. */
export interface TextInputClient {
  onChange(value: TextEditingValue): void; // proxy -> framework
  onSubmit?(): void; // Enter
  onCancel?(): void; // Escape
}

/** A live editing session; drives the proxy from the framework side. */
export interface TextInputConnection {
  setValue(value: TextEditingValue): void; // framework -> proxy
  close(): void; // end the editing session
}

/** Host seam that opens platform text-input editing sessions. */
export interface TextInputService {
  start(client: TextInputClient, initial: TextEditingValue): TextInputConnection;
}
