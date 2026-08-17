import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    clearMocks: true,
    environment: 'node',
    setupFiles: ['./__tests__/setup.unit.ts'],
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['clover', 'text'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/main.ts'],
      thresholds: {
        // Umbral global 90/85 propuesto originalmente: se midio en la practica
        // (yarn test --coverage, ver evidencia real) y NO es alcanzable sin
        // ampliar el alcance de esta mejora, porque state-helper.ts queda al
        // 0% de cobertura (ya lo estaba antes de este cambio, no lo toca esta
        // mejora) y arrastra el promedio global a ~59.6% / ~50.5%. Forzar aqui
        // 90/85 de forma global rompería 'yarn test' de inmediato sin haber
        // escrito ninguna prueba nueva para ese archivo, lo cual seria
        // maquillar el resultado en vez de corregir el documento.
        //
        // En su lugar, el umbral automatico se aplica de forma quirurgica al
        // modulo que si es objeto de esta mejora: src/config.ts, que alcanzo
        // 100% de sentencias y de ramas de verdad (ver Fase 3). Asi se cumple
        // el objetivo real de "impedir la regresion futura" para el codigo
        // nuevo, y queda documentado como trabajo futuro llevar state-helper.ts
        // y el resto de context.ts al umbral global 90/85.
        'src/config.ts': {
          statements: 100,
          branches: 100
        }
      }
    }
  }
});
