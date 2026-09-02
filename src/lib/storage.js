// localStorage puede fallar (modo privado, cuota llena) y puede contener basura
// de una versión anterior. Antes un valor corrupto reventaba el inicializador de
// useState, que en React es pantalla en blanco — no un fallo parcial.
export function readStored(key, fallback, parse) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const value = parse(raw);
    return value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

export function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Que no se guarde la preferencia no es motivo para tumbar la página.
  }
}

export const parseBoolean = (raw) => raw === 'true' || raw === '"true"' || raw === '1';

export const parseIntInRange = (raw, min, max) => {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(min, value));
};
