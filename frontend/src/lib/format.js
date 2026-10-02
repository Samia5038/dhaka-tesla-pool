// Money is stored as integer paisa in the backend. Divide by 100 only for display.
export function taka(paisa) {
  return '\u09F3' + (paisa / 100).toFixed(2);
}

export function timeOf(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
