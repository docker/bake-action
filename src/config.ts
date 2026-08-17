import * as core from '@actions/core';
import {Util} from '@docker/actions-toolkit/lib/util.js';

export const DEFAULTS = {
  checksAnnotations: true,
  summary: true,
  recordUpload: true
} as const;

/**
 * Lee una variable de entorno booleana y aplica el valor por defecto
 * cuando no está definida o contiene únicamente espacios.
 */
export function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  return Util.parseBool(raw.trim());
}

export function buildChecksAnnotationsEnabled(): boolean {
  return boolEnv('DOCKER_BUILD_CHECKS_ANNOTATIONS', DEFAULTS.checksAnnotations);
}

export function buildSummaryEnabled(): boolean {
  return boolEnv('DOCKER_BUILD_SUMMARY', DEFAULTS.summary);
}

export function buildRecordUploadEnabled(): boolean {
  return boolEnv('DOCKER_BUILD_RECORD_UPLOAD', DEFAULTS.recordUpload);
}

/**
 * Lee DOCKER_BUILD_RECORD_RETENTION_DAYS y la valida de forma estricta.
 *
 * Nota de implementación (verificada empíricamente, ver Fase 1 de las pruebas):
 * la función original usaba `parseInt(val)`. `parseInt` interpreta el prefijo
 * numérico de una cadena y descarta el resto sin error, por lo que
 * `parseInt("7 dias")` devuelve `7` en lugar de `NaN`. Eso significa que el
 * caso "valor inválido" documentado en la especificación original NO se
 * habría corregido si esta reescritura hubiera usado `Number.parseInt` en
 * vez de `parseInt`, porque ambas funciones comparten ese mismo comportamiento
 * de parseo parcial. Por eso aquí se usa `Number(...)`, que sí exige que la
 * cadena completa sea numérica y devuelve `NaN` ante cualquier resto no
 * numérico (`Number("7 dias")` → `NaN`), combinado con `Number.isInteger`
 * para rechazar además valores decimales.
 */
export function buildRecordRetentionDays(): number | undefined {
  const raw = process.env.DOCKER_BUILD_RECORD_RETENTION_DAYS;
  if (raw === undefined || raw.trim() === '') {
    return undefined;
  }
  const trimmed = raw.trim();
  const days = Number(trimmed);
  if (!Number.isInteger(days) || days < 0) {
    core.warning(`DOCKER_BUILD_RECORD_RETENTION_DAYS invalid value: "${raw}". Falling back to the repository retention policy.`);
    return undefined;
  }
  return days === 0 ? undefined : days;
}
