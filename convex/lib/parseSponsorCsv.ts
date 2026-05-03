/**
 * parseSponsorCsv.ts
 *
 * Parses the full Home Office sponsor register CSV into an array of SponsorRecords.
 *
 * Validated against real April 2026 register:
 * - 141,016 data rows
 * - 5 columns: Organisation Name, Town/City, County, Type & Rating, Route
 * - ~119k Skilled Worker rows after route filtering
 * - Names have leading spaces — handled by normaliseName trim
 * - No BOM in April 2026 file but handled defensively
 */

import { parseSponsorRow, isSkilledWorkerRoute, SponsorRecord } from "./parseSponsorRow";

export interface ParseCsvResult {
  records: SponsorRecord[];
  totalRows: number;
  skippedRows: number;
  nonSkilledWorkerRows: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * Minimal CSV line parser handling quoted fields and escaped quotes.
 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      fields.push(field.trim());
      field = "";
    } else {
      field += char;
    }
  }
  fields.push(field.trim());

  return fields;
}

/**
 * Parse a full CSV string (the Home Office register) into SponsorRecords.
 *
 * Only includes records on a Skilled Worker / Worker route.
 * Expected ~119k records from the ~141k total rows in the April 2026 register.
 *
 * @param csvText   - Raw CSV text
 * @param fetchedAt - Timestamp for this refresh run
 */
export function parseSponsorCsv(
  csvText: string,
  fetchedAt: number,
): ParseCsvResult {
  // Strip UTF-8 BOM if present
  const text = csvText.startsWith("\uFEFF") ? csvText.slice(1) : csvText;

  const lines = text.split(/\r?\n/);
  if (lines.length < 2) {
    return {
      records: [],
      totalRows: 0,
      skippedRows: 0,
      nonSkilledWorkerRows: 0,
      errors: [{ row: 0, error: "CSV has no data rows" }],
    };
  }

  const headers = parseCsvLine(lines[0]);

  const records: SponsorRecord[] = [];
  const errors: Array<{ row: number; error: string }> = [];
  let skippedRows = 0;
  let nonSkilledWorkerRows = 0;
  const totalRows = lines.length - 1;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      skippedRows++;
      continue;
    }

    const values = parseCsvLine(line);

    // Tolerate off-by-one column counts (trailing comma)
    if (Math.abs(values.length - headers.length) > 1) {
      errors.push({
        row: i + 1,
        error: `Column count mismatch: expected ${headers.length}, got ${values.length}`,
      });
      skippedRows++;
      continue;
    }

    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }

    // Filter to Skilled Worker routes only
    const route = (row["Route"] ?? row["route"] ?? "").trim();
    if (!isSkilledWorkerRoute(route)) {
      nonSkilledWorkerRows++;
      continue;
    }

    const result = parseSponsorRow(row, fetchedAt);
    if (!result.ok || !result.record) {
      errors.push({ row: i + 1, error: result.error ?? "Unknown parse error" });
      skippedRows++;
      continue;
    }

    records.push(result.record);
  }

  return {
    records,
    totalRows,
    skippedRows,
    nonSkilledWorkerRows,
    errors,
  };
}