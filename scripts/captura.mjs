#!/usr/bin/env node
// Capturas de la web con Chrome headless, controlado por el protocolo de
// depuracion y en tiempo REAL: las animaciones de framer-motion terminan y los
// JSON se cargan. (Con --screenshot y --virtual-time-budget todo se queda a
// opacidad 0.) Sirve para mirar un cambio de diseno antes de publicarlo, en
// escritorio y movil, claro y oscuro, sin extension ni dependencias.
//
//   node scripts/captura.mjs <salida.png> <url> [ancho] [alto] [dark] [selectorClick]
//   node scripts/captura.mjs antes.png https://opinion.carlosin120fps.duckdns.org/anime 1280 1400
//   node scripts/captura.mjs movil.png http://localhost:4173/manga/1 390 844 dark
//
// La ruta de Chrome sale de CO_CHROME o de la instalacion por defecto en Windows.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const [salida, url, anchoArg, altoArg, dark, click] = process.argv.slice(2);
const ancho = Number(anchoArg || 1280), alto = Number(altoArg || 1400);
const CH = process.env.CO_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const puerto = 9333 + Math.floor(Math.random() * 500);
const chrome = spawn(CH, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
  `--remote-debugging-port=${puerto}`, `--user-data-dir=${process.env.TEMP || '/tmp'}/co-chrome-${puerto}`,
  `--window-size=${ancho},${alto}`, 'about:blank',
], { stdio: 'ignore' });

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
try {
  let objetivo;
  for (let i = 0; i < 40 && !objetivo; i++) {
    await espera(250);
    objetivo = await fetch(`http://127.0.0.1:${puerto}/json/list`).then((r) => r.json())
      .then((l) => l.find((t) => t.type === 'page')).catch(() => null);
  }
  ws = new WebSocket(objetivo.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const cdp = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 1, mobile: ancho < 700 });
  if (dark === 'dark') await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await cdp('Page.navigate', { url });
  await espera(4000);
  if (click) {
    await cdp('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(click)})?.click()` });
    await espera(2500);
  }
  const { result } = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(salida, Buffer.from(result.data, 'base64'));
  console.log(`ok ${salida}`);
} finally {
  ws?.close();
  chrome.kill();
}
