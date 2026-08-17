import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';

import * as config from '../src/config.js';

const originalEnv = process.env;

beforeEach(() => {
  process.env = {...originalEnv};
});

afterEach(() => {
  process.env = originalEnv;
});

// Las funciones envoltorio (buildChecksAnnotationsEnabled, buildRecordUploadEnabled)
// no quedaban cubiertas por ninguna prueba en la especificación original de este
// archivo: solo se probaba boolEnv() de forma indirecta a través de
// buildSummaryEnabled(). Esto se detectó al ejecutar `yarn test --coverage`
// (líneas 22-24 y 30-32 de src/config.ts aparecían como no cubiertas), así que
// se añaden estas dos pruebas para cerrar ese hueco real y alcanzar cobertura
// completa del módulo.
describe('wrappers de config.ts sobre boolEnv', () => {
  test('buildChecksAnnotationsEnabled expone DOCKER_BUILD_CHECKS_ANNOTATIONS', () => {
    delete process.env.DOCKER_BUILD_CHECKS_ANNOTATIONS;
    expect(config.buildChecksAnnotationsEnabled()).toBe(true);
    process.env.DOCKER_BUILD_CHECKS_ANNOTATIONS = 'false';
    expect(config.buildChecksAnnotationsEnabled()).toBe(false);
  });

  test('buildRecordUploadEnabled expone DOCKER_BUILD_RECORD_UPLOAD', () => {
    delete process.env.DOCKER_BUILD_RECORD_UPLOAD;
    expect(config.buildRecordUploadEnabled()).toBe(true);
    process.env.DOCKER_BUILD_RECORD_UPLOAD = 'false';
    expect(config.buildRecordUploadEnabled()).toBe(false);
  });
});

describe('boolEnv', () => {
  // prettier-ignore
  test.each([
    [undefined,  true ],   // variable ausente  -> valor por defecto
    ['',         true ],   // cadena vacía      -> valor por defecto
    ['   ',      true ],   // solo espacios     -> valor por defecto
    ['false',    false],   // desactivación explícita
    [' false ',  false],   // tolera espacios alrededor
    ['0',        false],
    ['true',     true ],
  ])('DOCKER_BUILD_SUMMARY=%o devuelve %o', (value, expected) => {
    if (value === undefined) {
      delete process.env.DOCKER_BUILD_SUMMARY;
    } else {
      process.env.DOCKER_BUILD_SUMMARY = value;
    }
    expect(config.buildSummaryEnabled()).toBe(expected);
  });
});

describe('buildRecordRetentionDays', () => {
  test('devuelve undefined cuando la variable no está definida', () => {
    delete process.env.DOCKER_BUILD_RECORD_RETENTION_DAYS;
    expect(config.buildRecordRetentionDays()).toBeUndefined();
  });

  test('devuelve el número cuando el valor es válido', () => {
    process.env.DOCKER_BUILD_RECORD_RETENTION_DAYS = '7';
    expect(config.buildRecordRetentionDays()).toBe(7);
  });

  test('trata el valor 0 como política del repositorio', () => {
    process.env.DOCKER_BUILD_RECORD_RETENTION_DAYS = '0';
    expect(config.buildRecordRetentionDays()).toBeUndefined();
  });

  // "7 dias" es el caso crítico: parseInt("7 dias") = 7 (parseo parcial), por lo
  // que la función original NO fallaba realmente con este valor (se comprobó
  // en la Fase 1 de pruebas contra la implementación original). Number("7 dias")
  // sí produce NaN porque exige que la cadena completa sea numérica, así que
  // este caso es el que valida que la corrección realmente funciona.
  //
  // Nota de implementación: se intentó primero `vi.spyOn(core, 'warning')`
  // como proponía la especificación original, pero falla en este proyecto con
  // `TypeError: Cannot redefine property: warning` porque `@actions/core` se
  // consume como módulo ESM y su namespace no es configurable (comprobado al
  // ejecutar la batería real). Se usa entonces la alternativa que la propia
  // especificación había previsto para ese caso: interceptar
  // `process.stdout.write`, que es el mecanismo real que usa
  // `@actions/core` para emitir `core.warning()` como el comando de
  // GitHub Actions `::warning::mensaje`.
  test.each([['7 dias'], ['abc'], ['-5'], ['3.5']])('advierte y degrada ante el valor inválido %o', value => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    process.env.DOCKER_BUILD_RECORD_RETENTION_DAYS = value;

    let result: number | undefined;
    expect(() => {
      result = config.buildRecordRetentionDays();
    }).not.toThrow();
    expect(result).toBeUndefined();

    const output = stdoutSpy.mock.calls.map(call => String(call[0])).join('');
    expect(output).toContain('::warning::');
    expect(output).toContain('DOCKER_BUILD_RECORD_RETENTION_DAYS');

    stdoutSpy.mockRestore();
  });
});
