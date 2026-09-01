export const LABEL_WIDTH_MM = 25;
export const LABEL_HEIGHT_MM = 25;
export const LABELS_PER_ROW = 4;
export const LABEL_COLUMN_GAP_MM = 0;
export const LABEL_ROW_GAP_MM = 0;

export const LABEL_MEDIA_WIDTH_MM =
  (LABEL_WIDTH_MM * LABELS_PER_ROW) + (LABEL_COLUMN_GAP_MM * (LABELS_PER_ROW - 1));
export const LABEL_MEDIA_ROW_HEIGHT_MM = LABEL_HEIGHT_MM + LABEL_ROW_GAP_MM;

export type LabelPrintSlot = number | null;

export const formatPackedMonthYear = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;

  const [year, month] = parts;
  const shortYear = year.length === 4 ? year.slice(2) : year;
  return `${month}/${shortYear}`;
};

export const createLabelPrintRows = (copies: number): LabelPrintSlot[][] => {
  const boundedCopies = Math.max(0, Math.floor(copies));
  const rows: LabelPrintSlot[][] = [];

  for (let start = 0; start < boundedCopies; start += LABELS_PER_ROW) {
    const row: LabelPrintSlot[] = [];
    for (let slot = 0; slot < LABELS_PER_ROW; slot += 1) {
      const copyIndex = start + slot;
      row.push(copyIndex < boundedCopies ? copyIndex : null);
    }
    rows.push(row);
  }

  return rows;
};
