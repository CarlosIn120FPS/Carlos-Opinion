// Git para el modo servidor: el panel es otro cliente del repositorio, no una vía
// paralela que se salta el control de versiones. Cada cambio es un commit, con su
// historial y su `git revert` gratis.
//
// El panel COMMITEA pero NO EMPUJA. Empujar dispara el hook, que compila (~60 s en
// un dv6), y `git receive-pack` es hijo del push: si eso fuese dentro de la
// petición HTTP, escribir una nota de dos frases costaría un minuto mirando una
// ruedecita. Del push se encarga un timer aparte.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const ejecutar = promisify(execFile);

export function repoGit(dir) {
  const git = (...args) =>
    ejecutar('git', ['-C', dir, ...args], { encoding: 'utf8', maxBuffer: 20e6 });

  return {
    /**
     * Deja el árbol utilizable pase lo que pase. Si el proceso murió entre
     * escribir y commitear (OOM, reinicio, corte de luz), queda una modificación
     * suelta y `git rebase` se niega a seguir con el árbol sucio — el panel se
     * quedaría inservible sin decir por qué.
     *
     * Tirar esa modificación es seguro: el cliente nunca recibió el 200 de esa
     * operación, así que para él nunca ocurrió.
     */
    async sanear() {
      await git('rebase', '--abort').catch(() => {});
      const { stdout } = await git('status', '--porcelain');
      if (stdout.trim()) {
        await git('checkout', '--', '.');
        return true; // hubo que limpiar
      }
      return false;
    },

    /**
     * Ponerse al día con el bare ANTES de cada operación. Sin esto, Carlos
     * promociona un borrador desde el PC, lo empuja, abre el panel en el móvil y
     * no lo ve: datos rancios. Y eso es lo que hace que se deje de usar una
     * herramienta.
     *
     * `rebase` y no `reset --hard`: conserva lo que aún no se ha empujado. El
     * remoto es file:// en el mismo disco, así que son milisegundos.
     */
    async sincronizar() {
      await this.sanear();
      await git('fetch', '--quiet', 'origin', 'main');
      try {
        await git('rebase', '--quiet', 'origin/main');
      } catch (e) {
        // Un conflicto aquí sólo puede venir de que alguien editara los mismos
        // datos por otro camino. Gana lo que está publicado; lo nuestro se
        // reintenta desde el cliente, que aún tiene su cola.
        await git('rebase', '--abort').catch(() => {});
        await git('reset', '--hard', 'origin/main');
        throw new Error(`no se pudo poner al día, se descartó lo local: ${e.message}`);
      }
    },

    async commitear(mensaje, rutas) {
      await git('add', '--', ...rutas);
      const { stdout } = await git('status', '--porcelain', '--', ...rutas);
      if (!stdout.trim()) return null; // nada que commitear
      await git('commit', '--quiet', '-m', mensaje);
      const { stdout: rev } = await git('rev-parse', 'HEAD');
      return rev.trim();
    },

    /** Cuántos commits hay sin empujar. */
    async pendientes() {
      const { stdout } = await git('rev-list', '--count', 'origin/main..HEAD');
      return Number(stdout.trim()) || 0;
    },

    async empujar(remoto) {
      const { stdout, stderr } = await git('push', remoto, 'main');
      return `${stdout}${stderr}`;
    },

    async cabeza() {
      const { stdout } = await git('rev-parse', 'HEAD');
      return stdout.trim();
    },

    // --- los borradores del generador -------------------------------------
    // Viven en una rama aparte y NUNCA se sacan con checkout: se leen con
    // `git show`. Así no queda un directorio drafts/ en el árbol de trabajo
    // esperando a que un `git add .` distraído lo publique.

    async traerBorradores(remoto) {
      await git('fetch', '--quiet', remoto, 'borradores').catch(() => {});
    },

    /** Los ids de borrador que hay en una carpeta, o [] si no hay rama. */
    async listarBorradores(remoto, carpeta) {
      try {
        const { stdout } = await git('ls-tree', '--name-only', `${remoto}/borradores:${carpeta}`);
        return stdout.split('\n').map((f) => f.trim())
          .filter((f) => f.endsWith('.json'))
          .map((f) => f.replace(/\.json$/, ''));
      } catch {
        return [];
      }
    },

    async leerBorrador(remoto, carpeta, id) {
      const { stdout } = await git('show', `${remoto}/borradores:${carpeta}/${id}.json`);
      return JSON.parse(stdout);
    },
  };
}
