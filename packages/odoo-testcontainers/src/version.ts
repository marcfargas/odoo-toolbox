/**
 * Normalise a raw ODOO_VERSION value into the full dotted form.
 *
 * @example
 *   normaliseOdooVersion('17')   -> '17.0'
 *   normaliseOdooVersion('17.0') -> '17.0'
 */
export function normaliseOdooVersion(raw: string | undefined): string {
  if (!raw) return '17.0';
  if (raw.includes('.')) return raw;
  return `${raw}.0`;
}
