import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { expensesAPI } from '../api/services';
import { useAuthStore } from '../store/auth';
import { matchCategoryIcon } from '../utils/categoryHelpers';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ParsedRow {
  id: number;
  date: string;       // raw from CSV
  amount: number;
  category: string;
  title: string;      // from "Notes" column
  // validation
  valid: boolean;
  errors: string[];
  selected: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const CATEGORY_ALIASES: Record<string, string> = {
  food: 'Food', eating: 'Food', restaurant: 'Food', grocery: 'Food', groceries: 'Food', meal: 'Food',
  travel: 'Travel', transport: 'Travel', uber: 'Travel', cab: 'Travel', bus: 'Travel', train: 'Travel',
  shopping: 'Shopping', clothes: 'Shopping', amazon: 'Shopping',
  rent: 'Rent', house: 'Rent', electricity: 'Rent', utility: 'Rent', bill: 'Rent',
  entertainment: 'Entertainment', movie: 'Entertainment', game: 'Entertainment', netflix: 'Entertainment',
  others: 'Others', other: 'Others', misc: 'Others', miscellaneous: 'Others',
};

function normalizeCategory(raw: string): string {
  const lower = raw.trim().toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_ALIASES)) {
    if (lower.includes(key)) return val;
  }
  // Title-case the raw value as a custom category
  return raw.trim() ? raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1) : 'Others';
}

function parseDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Try ISO
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const d = new Date(`${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmyMatch) {
    const year = dmyMatch[3].length === 2 ? `20${dmyMatch[3]}` : dmyMatch[3];
    const d = new Date(`${year}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  // Try MM/DD/YYYY
  const mdyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdyMatch) {
    const year = mdyMatch[3].length === 2 ? `20${mdyMatch[3]}` : mdyMatch[3];
    const d = new Date(`${year}-${mdyMatch[1].padStart(2, '0')}-${mdyMatch[2].padStart(2, '0')}`);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  // Fallback: native Date parse
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Find header row (case-insensitive)
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

  const dateIdx = headers.findIndex(h => h.includes('date'));
  const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('price') || h.includes('cost'));
  const categoryIdx = headers.findIndex(h => h.includes('category') || h.includes('type'));
  const notesIdx = headers.findIndex(h =>
    h.includes('notes') || h.includes('note') || h.includes('description') || h.includes('title') || h.includes('narration') || h.includes('particulars')
  );

  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Respect quoted commas
    const cols: string[] = [];
    let cur = '';
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { cols.push(cur); cur = ''; }
      else cur += ch;
    }
    cols.push(cur);

    const rawDate = dateIdx >= 0 ? (cols[dateIdx] || '').trim() : '';
    const rawAmount = amountIdx >= 0 ? (cols[amountIdx] || '').trim() : '';
    const rawCategory = categoryIdx >= 0 ? (cols[categoryIdx] || '').trim() : '';
    const rawNotes = notesIdx >= 0 ? (cols[notesIdx] || '').trim() : '';

    const errors: string[] = [];

    const parsedDate = parseDate(rawDate);
    if (!parsedDate) errors.push(`Invalid date: "${rawDate}"`);

    const cleanAmt = rawAmount.replace(/[₹$£€,\s]/g, '');
    const amount = parseFloat(cleanAmt);
    if (isNaN(amount) || amount <= 0) errors.push(`Invalid amount: "${rawAmount}"`);

    const title = rawNotes || rawCategory || 'Imported expense';
    const category = normalizeCategory(rawCategory || 'Others');

    rows.push({
      id: i,
      date: parsedDate || rawDate,
      amount: isNaN(amount) ? 0 : amount,
      category,
      title,
      valid: errors.length === 0,
      errors,
      selected: errors.length === 0,
    });
  }

  return rows;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
  } catch { return iso; }
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ImportExpensePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
      setStep('preview');
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) handleFile(file);
    else toast.error('Please drop a .csv file');
  };

  const toggleRow = (id: number) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r));
  };

  const toggleAll = (val: boolean) => {
    setRows(prev => prev.map(r => r.valid ? { ...r, selected: val } : r));
  };

  const selectedRows = rows.filter(r => r.selected && r.valid);
  const validCount = rows.filter(r => r.valid).length;
  const invalidCount = rows.filter(r => !r.valid).length;

  const handleImport = async () => {
    if (!user || selectedRows.length === 0) return;
    setImporting(true);
    let success = 0;
    let fail = 0;

    for (const row of selectedRows) {
      try {
        await expensesAPI.create({
          title: row.title,
          amount: row.amount,
          payment_method: 'Cash',
          category: row.category,
          split_type: 'equal',
          expense_date: row.date,
          participants: ['you'],
        });
        success++;
      } catch {
        fail++;
      }
    }

    setImportedCount(success);
    setImporting(false);
    setStep('done');
    if (fail > 0) toast.error(`${fail} rows failed to import`);
  };

  // ── Upload step ─────────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <Layout showBack title="Import Expenses">
        <div className="page-container page-enter flex flex-col gap-6">
          <div>
            <h1 className="text-xl font-bold text-primary">Import from CSV</h1>
            <p className="text-sm text-on-surface-variant/70 mt-1">
              Upload a CSV file to bulk-import your expenses.
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="glass-panel rounded-2xl border-2 border-dashed border-primary/30 hover:border-primary/60 transition-colors cursor-pointer p-10 flex flex-col items-center gap-4 text-center active:scale-[0.98] select-none"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-primary">upload_file</span>
            </div>
            <div>
              <p className="font-bold text-base text-primary">Tap to choose a CSV file</p>
              <p className="text-xs text-on-surface-variant/60 mt-1">or drag & drop here</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>

          {/* Expected format */}
          <div className="glass-panel rounded-2xl p-4 space-y-3">
            <h2 className="font-semibold text-sm text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">info</span>
              Expected CSV Format
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-container">
                    {['Date', 'Amount', 'Category', 'Notes'].map(h => (
                      <th key={h} className="text-left px-3 py-2 font-bold text-primary rounded first:rounded-l-lg last:rounded-r-lg">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['2024-01-15', '450', 'Food', 'Lunch at Zomato'],
                    ['15/01/2024', '1200', 'Travel', 'Uber to office'],
                    ['Jan 15 2024', '3500', 'Shopping', 'New shirt'],
                  ].map((row, i) => (
                    <tr key={i} className="border-t border-outline-variant/10">
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-2 text-on-surface-variant/70">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-1 text-xs text-on-surface-variant/60">
              <p>✓ Date formats: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, Jan 15 2024</p>
              <p>✓ Amount: supports ₹, $, commas (e.g. ₹1,500)</p>
              <p>✓ Column headers are case-insensitive</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Done step ───────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <Layout showBack title="Import Complete">
        <div className="page-container page-enter flex flex-col items-center justify-center gap-6 min-h-[60vh] text-center">
          <div className="w-24 h-24 rounded-full bg-secondary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-5xl text-secondary">check_circle</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary">{importedCount} Imported!</h1>
            <p className="text-sm text-on-surface-variant/70 mt-2">
              Successfully imported {importedCount} expense{importedCount !== 1 ? 's' : ''} from <span className="font-semibold text-primary">{fileName}</span>
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={() => navigate('/history')}
              className="btn-primary w-full h-12 text-sm shadow-none rounded-xl"
            >
              <span className="material-symbols-outlined text-[18px]">history</span>
              View in History
            </button>
            <button
              onClick={() => { setStep('upload'); setRows([]); setFileName(''); }}
              className="btn-secondary w-full h-12 text-sm text-primary border-primary/20"
            >
              Import Another File
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Preview step ─────────────────────────────────────────────────────────────
  return (
    <Layout showBack title="Preview Import">
      {/* Sticky import footer */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-outline-variant/20 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-on-surface-variant/70">Selected</p>
            <p className="font-bold text-sm text-primary">{selectedRows.length} of {validCount} rows</p>
          </div>
          <button
            onClick={handleImport}
            disabled={importing || selectedRows.length === 0}
            className="btn-primary h-11 px-6 text-sm shadow-none rounded-xl disabled:opacity-60 flex items-center gap-2"
          >
            {importing
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Importing…</>
              : <><span className="material-symbols-outlined text-[18px]">cloud_upload</span>Import {selectedRows.length}</>
            }
          </button>
        </div>
      </div>

      <div className="page-container page-enter pb-28 space-y-4">
        {/* Summary bar */}
        <div className="glass-panel rounded-2xl p-4 flex items-center gap-4">
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-primary">{rows.length}</p>
            <p className="text-xs text-on-surface-variant/60">Total rows</p>
          </div>
          <div className="w-px h-8 bg-outline-variant/20" />
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-secondary">{validCount}</p>
            <p className="text-xs text-on-surface-variant/60">Valid</p>
          </div>
          {invalidCount > 0 && (
            <>
              <div className="w-px h-8 bg-outline-variant/20" />
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold text-error">{invalidCount}</p>
                <p className="text-xs text-on-surface-variant/60">Skipped</p>
              </div>
            </>
          )}
        </div>

        {/* File name + reselect */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">description</span>
            <p className="text-sm font-semibold text-primary truncate max-w-[200px]">{fileName}</p>
          </div>
          <button
            onClick={() => { setStep('upload'); setRows([]); setFileName(''); }}
            className="text-xs text-primary font-bold hover:underline"
          >
            Change file
          </button>
        </div>

        {/* Select all / none */}
        {validCount > 0 && (
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-on-surface-variant/70">{selectedRows.length} selected</p>
            <div className="flex gap-3">
              <button onClick={() => toggleAll(true)} className="text-xs text-primary font-semibold hover:underline">Select all</button>
              <button onClick={() => toggleAll(false)} className="text-xs text-on-surface-variant/60 hover:underline">Deselect all</button>
            </div>
          </div>
        )}

        {/* Row list */}
        <div className="flex flex-col gap-2">
          {rows.map(row => (
            <div
              key={row.id}
              onClick={() => row.valid && toggleRow(row.id)}
              className={`glass-panel rounded-2xl p-4 flex items-center gap-3 transition-all ${
                !row.valid
                  ? 'opacity-50 border border-error/20 bg-error/5'
                  : row.selected
                  ? 'border border-primary/30 bg-primary/5 cursor-pointer active:scale-[0.98]'
                  : 'border border-outline-variant/10 cursor-pointer active:scale-[0.98]'
              }`}
            >
              {/* Checkbox */}
              <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                !row.valid
                  ? 'bg-error/20 border border-error/30'
                  : row.selected
                  ? 'bg-primary'
                  : 'border-2 border-outline-variant/40'
              }`}>
                {row.valid && row.selected && (
                  <span className="material-symbols-outlined text-on-primary text-[14px]">check</span>
                )}
                {!row.valid && (
                  <span className="material-symbols-outlined text-error text-[14px]">close</span>
                )}
              </div>

              {/* Category icon */}
              <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-base shrink-0">
                {matchCategoryIcon(row.category)}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-primary truncate">{row.title}</p>
                <p className="text-xs text-on-surface-variant/70">
                  {row.valid ? formatDate(row.date) : row.errors.join(', ')} · {row.category}
                </p>
              </div>

              {/* Amount */}
              <p className={`font-bold text-sm shrink-0 ${row.valid ? 'text-primary' : 'text-error'}`}>
                ₹{row.amount > 0 ? row.amount.toLocaleString('en-IN') : '?'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
