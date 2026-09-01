/**
 * Exact Decimal Arithmetic Utility for POS Billing
 *
 * Implements deterministic integer/BigInt arithmetic for currency and quantity
 * calculations without JavaScript IEEE 754 floating-point inaccuracies.
 */

const RATE_DECIMALS = 2;
const QTY_DECIMALS = 3;
const QTY_SCALE = 1000n;

/**
 * Parses a numeric string into BigInt with fixed decimal scaling.
 * Example: parseToScaledBigInt("12.5", 2) => 1250n
 */
export function parseToScaledBigInt(value: string | number, targetDecimals: number): bigint {
  const str = String(value).trim();
  if (!str) {
    return 0n;
  }

  const isNegative = str.startsWith('-');
  const cleanStr = isNegative ? str.slice(1).trim() : str;

  const parts = cleanStr.split('.');
  const wholePart = parts[0] || '0';
  let fracPart = parts[1] || '';

  if (fracPart.length > targetDecimals) {
    // Truncate extra decimals beyond precision limit
    fracPart = fracPart.slice(0, targetDecimals);
  } else {
    // Pad with zeros to target scale
    fracPart = fracPart.padEnd(targetDecimals, '0');
  }

  // Remove leading zeros for clean BigInt parsing
  const combinedStr = `${wholePart}${fracPart}`.replace(/^0+(?=\d)/, '') || '0';
  const val = BigInt(combinedStr);

  return isNegative ? -val : val;
}

/**
 * Formats scaled BigInt into fixed decimal string.
 * Example: formatScaledBigInt(1250n, 2) => "12.50"
 */
export function formatScaledBigInt(val: bigint, targetDecimals: number): string {
  const isNegative = val < 0n;
  const absVal = isNegative ? -val : val;

  const scale = 10n ** BigInt(targetDecimals);
  const whole = absVal / scale;
  const frac = absVal % scale;

  const fracStr = frac.toString().padStart(targetDecimals, '0');
  const result = `${whole.toString()}.${fracStr}`;

  return isNegative ? `-${result}` : result;
}

/**
 * Multiplies unit rate (2 decimals) by quantity (up to 3 decimals)
 * to calculate line item amount (2 decimals) with standard half-up rounding.
 *
 * (rateCents * qtyMillis + 500n) / 1000n => amountCents
 */
export function multiplyRateAndQuantity(rateStr: string, qtyStr: string): string {
  if (!rateStr || !qtyStr) return '0.00';

  const rateCents = parseToScaledBigInt(rateStr, RATE_DECIMALS);
  const qtyMillis = parseToScaledBigInt(qtyStr, QTY_DECIMALS);

  if (rateCents <= 0n || qtyMillis <= 0n) {
    return '0.00';
  }

  // Multiply scaled values: cents * millis
  const rawProduct = rateCents * qtyMillis;

  // Divide by QTY_SCALE (1000n) with half-up rounding (+ 500n)
  const amountCents = (rawProduct + (QTY_SCALE / 2n)) / QTY_SCALE;

  return formatScaledBigInt(amountCents, RATE_DECIMALS);
}

/**
 * Sums an array of 2-decimal currency amounts.
 */
export function sumAmounts(amounts: string[]): string {
  let totalCents = 0n;
  for (const amt of amounts) {
    if (amt && amt.trim()) {
      totalCents += parseToScaledBigInt(amt, RATE_DECIMALS);
    }
  }
  return formatScaledBigInt(totalCents, RATE_DECIMALS);
}

/**
 * Sums two quantity strings with 3 decimals scale and cleans trailing zeros.
 * Example: addQuantities("1", "1") => "2"
 * Example: addQuantities("2.500", "1") => "3.5"
 */
export function addQuantities(qtyA: string, qtyB: string): string {
  const aMillis = parseToScaledBigInt(qtyA || '0', QTY_DECIMALS);
  const bMillis = parseToScaledBigInt(qtyB || '0', QTY_DECIMALS);
  const sumMillis = aMillis + bMillis;

  const formatted = formatScaledBigInt(sumMillis, QTY_DECIMALS);
  // Trim trailing decimal zeros if practical, keeping at least integer
  return formatted.replace(/\.?0+$/, '') || '0';
}

/**
 * Increments a quantity string by exactly 1 unit.
 */
export function incrementQuantity(qtyStr: string): string {
  return addQuantities(qtyStr, '1');
}

/**
 * Validates whether a quantity string is a valid positive decimal (> 0).
 */
export function isValidPositiveDecimal(val: string): boolean {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return false;

  // Must match positive decimal format (e.g. "1", "1.5", "0.25", "100.000")
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return false;

  const millis = parseToScaledBigInt(trimmed, QTY_DECIMALS);
  return millis > 0n;
}

/**
 * Formats an amount string for display with Indian Rupee symbol.
 * Example: formatDisplayCurrency("1250.50") => "₹1,250.50"
 */
export function formatDisplayCurrency(amount: string): string {
  if (!amount) return '₹0.00';
  const clean = amount.trim();
  const parts = clean.split('.');
  const wholePart = parts[0] || '0';
  const fracPart = (parts[1] || '00').padEnd(2, '0').slice(0, 2);

  // Format integer part with Indian thousands separator
  const formattedWhole = Number(wholePart).toLocaleString('en-IN');
  return `₹${formattedWhole}.${fracPart}`;
}

/**
 * Compares two decimal quantity strings using exact BigInt millis (3 decimal scale).
 * Returns:
 *   -1 if qtyA < qtyB
 *    0 if qtyA === qtyB
 *    1 if qtyA > qtyB
 */
export function compareQuantities(qtyA: string, qtyB: string): number {
  const aMillis = parseToScaledBigInt(qtyA || '0', QTY_DECIMALS);
  const bMillis = parseToScaledBigInt(qtyB || '0', QTY_DECIMALS);
  if (aMillis < bMillis) return -1;
  if (aMillis > bMillis) return 1;
  return 0;
}

/**
 * Checks if stock is strictly positive (> 0) using exact scaled BigInt.
 */
export function isStockAvailable(stockStr: string | undefined | null): boolean {
  if (!stockStr) return false;
  const millis = parseToScaledBigInt(stockStr, QTY_DECIMALS);
  return millis > 0n;
}

/**
 * Checks if requested quantity is valid and within available stock (0 < requestedQty <= stock)
 * using exact scaled BigInt arithmetic.
 */
export function isQuantityWithinStock(requestedQty: string, stockStr: string | undefined | null): boolean {
  if (!stockStr || !isValidPositiveDecimal(requestedQty)) return false;
  const reqMillis = parseToScaledBigInt(requestedQty, QTY_DECIMALS);
  const stockMillis = parseToScaledBigInt(stockStr, QTY_DECIMALS);
  return reqMillis > 0n && reqMillis <= stockMillis;
}

/**
 * Formats a quantity (string or number, up to 3 decimals) cleanly for
 * user-facing display: trims trailing zeros without changing the value.
 * e.g. "97.000" -> "97", "2.500" -> "2.5", "0.125" -> "0.125"
 *
 * Not for money — money always keeps its fixed 2-decimal format.
 */
export function formatQuantity(qty: string | number | undefined | null): string {
  if (qty === undefined || qty === null || qty === '') return '0';
  const clean = String(qty).trim();
  if (!clean || Number.isNaN(Number(clean))) return '0';
  const isNegative = clean.startsWith('-');
  const unsigned = isNegative ? clean.slice(1) : clean;
  const parts = unsigned.split('.');
  const wholePart = parts[0] || '0';
  const fracPart = (parts[1] || '').replace(/0+$/, '');
  const formatted = fracPart ? `${wholePart}.${fracPart}` : wholePart;
  return isNegative && formatted !== '0' ? `-${formatted}` : formatted;
}

/**
 * Returns a YYYY-MM-DD date string derived strictly from LOCAL calendar parts.
 *
 * Invariant: If local date is 2026-09-02, returns "2026-09-02" regardless of UTC date.
 * Never uses Date.prototype.toISOString() which converts to UTC.
 */
export function getLocalCalendarDate(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Computes the exact ISO datetime range for the current LOCAL calendar day.
 *
 * Establishes shop local calendar boundaries:
 *   start: local 00:00:00.000
 *   end:   local 23:59:59.999
 *
 * Serializes these exact local boundary instants with toISOString() to satisfy
 * backend schema requirements: z.string().datetime()
 */
export function getLocalDayBoundaryIsoRange(now: Date = new Date()): { startDate: string; endDate: string } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
}
