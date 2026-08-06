/**
 * ImportExpenseScreen — exact port of web's ImportExpensePage.tsx
 *
 * Steps:
 *  1. "Upload" — pick a CSV file via expo-document-picker
 *  2. "Preview" — parsed rows with valid/invalid indicators + select/deselect
 *  3. "Done" — success summary with navigation to History
 *
 * CSV format: Date, Amount, Category, Notes (case-insensitive headers)
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import Toast from 'react-native-toast-message';
import TopBar from '../components/TopBar';
import Skeleton from '../components/Skeleton';
import { useAuthStore } from '../store/auth';
import { expensesAPI } from '../api/services';
import { matchCategoryIcon } from '../utils/categoryHelpers';
import { colors, fontSizes, fontWeights, radius, spacing, shadows, glassPanel } from '../theme';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ParsedRow {
  id: number;
  date: string;
  amount: number;
  category: string;
  title: string;
  valid: boolean;
  errors: string[];
  selected: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
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
  return raw.trim() ? raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1) : 'Others';
}

function parseDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const d = new Date(`${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmyMatch) {
    const year = dmyMatch[3].length === 2 ? `20${dmyMatch[3]}` : dmyMatch[3];
    const d = new Date(`${year}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  const mdyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdyMatch) {
    const year = mdyMatch[3].length === 2 ? `20${mdyMatch[3]}` : mdyMatch[3];
    const d = new Date(`${year}-${mdyMatch[1].padStart(2, '0')}-${mdyMatch[2].padStart(2, '0')}`);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

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

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
  } catch { return iso; }
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function ImportExpenseScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const { user } = useAuthStore();

  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');

  const handlePickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const file = result.assets[0];
      if (!file.name.toLowerCase().endsWith('.csv')) {
        Toast.show({ type: 'error', text1: 'Please select a .csv file' });
        return;
      }

      setFileName(file.name);
      const content = await FileSystem.readAsStringAsync(file.uri);
      const parsed = parseCSV(content);
      if (parsed.length === 0) {
        Toast.show({ type: 'error', text1: 'No valid rows found in CSV' });
        return;
      }
      setRows(parsed);
      setStep('preview');
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Failed to read file' });
    }
  }, []);

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
    if (fail > 0) Toast.show({ type: 'error', text1: `${fail} rows failed to import` });
  };

  // ── Upload step ─────────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <TopBar title="Import Expenses" showBack />
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.headerSection}>
            <Text style={styles.pageTitle}>Import from CSV</Text>
            <Text style={styles.pageSubtitle}>Upload a CSV file to bulk-import your expenses.</Text>
          </View>

          {/* Tap to pick file */}
          <TouchableOpacity style={styles.dropZone} onPress={handlePickFile} activeOpacity={0.8}>
            <View style={styles.dropIcon}>
              <Ionicons name="cloud-upload-outline" size={36} color={colors.primary} />
            </View>
            <Text style={styles.dropTitle}>Tap to choose a CSV file</Text>
            <Text style={styles.dropSubtitle}>Supports .csv files from your device</Text>
          </TouchableOpacity>

          {/* Format guide */}
          <View style={[styles.infoCard, glassPanel]}>
            <View style={styles.infoHeader}>
              <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.infoTitle}>Expected CSV Format</Text>
            </View>
            <View style={styles.table}>
              {/* Header row */}
              <View style={[styles.tableRow, styles.tableHeaderRow]}>
                {['Date', 'Amount', 'Category', 'Notes'].map(h => (
                  <Text key={h} style={[styles.tableCell, styles.tableHeaderCell]}>{h}</Text>
                ))}
              </View>
              {/* Sample rows */}
              {[
                ['2024-01-15', '450', 'Food', 'Lunch'],
                ['15/01/2024', '1200', 'Travel', 'Uber'],
                ['Jan 15 2024', '3500', 'Shopping', 'Shirt'],
              ].map((row, i) => (
                <View key={i} style={styles.tableRow}>
                  {row.map((cell, j) => (
                    <Text key={j} style={styles.tableCell}>{cell}</Text>
                  ))}
                </View>
              ))}
            </View>
            <Text style={styles.infoNote}>✓ Date: YYYY-MM-DD, DD/MM/YYYY, or natural language</Text>
            <Text style={styles.infoNote}>✓ Amount: supports ₹, $, commas (e.g. ₹1,500)</Text>
            <Text style={styles.infoNote}>✓ Column headers are case-insensitive</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Done step ───────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <TopBar title="Import Complete" showBack />
        <View style={styles.doneContainer}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark-circle" size={56} color={colors.secondary} />
          </View>
          <Text style={styles.doneTitle}>{importedCount} Imported!</Text>
          <Text style={styles.doneSubtitle}>
            Successfully imported {importedCount} expense{importedCount !== 1 ? 's' : ''} from{' '}
            <Text style={{ fontWeight: '700', color: colors.primary }}>{fileName}</Text>
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => { nav.navigate('Tabs', { screen: 'Home' }); }}
            activeOpacity={0.85}
          >
            <Ionicons name="home-outline" size={18} color={colors.onPrimary} />
            <Text style={styles.primaryBtnText}>Go to History</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => { setStep('upload'); setRows([]); setFileName(''); }}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>Import Another File</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Preview step ────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <TopBar title="Preview Import" showBack />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 120 }]} showsVerticalScrollIndicator={false}>

        {/* Summary bar */}
        <View style={[styles.summaryBar, glassPanel]}>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryNum}>{rows.length}</Text>
            <Text style={styles.summaryLabel}>Total rows</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <Text style={[styles.summaryNum, { color: colors.secondary }]}>{validCount}</Text>
            <Text style={styles.summaryLabel}>Valid</Text>
          </View>
          {invalidCount > 0 && (
            <>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryCol}>
                <Text style={[styles.summaryNum, { color: colors.error }]}>{invalidCount}</Text>
                <Text style={styles.summaryLabel}>Skipped</Text>
              </View>
            </>
          )}
        </View>

        {/* File name + reselect */}
        <View style={styles.fileRow}>
          <View style={styles.fileNameRow}>
            <Ionicons name="document-text-outline" size={16} color={colors.onSurfaceVariant} />
            <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
          </View>
          <TouchableOpacity onPress={() => { setStep('upload'); setRows([]); setFileName(''); }}>
            <Text style={styles.changeFile}>Change file</Text>
          </TouchableOpacity>
        </View>

        {/* Select all / none */}
        {validCount > 0 && (
          <View style={styles.selectRow}>
            <Text style={styles.selectCount}>{selectedRows.length} selected</Text>
            <View style={styles.selectBtns}>
              <TouchableOpacity onPress={() => toggleAll(true)}>
                <Text style={styles.selectAll}>Select all</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => toggleAll(false)}>
                <Text style={styles.deselectAll}>Deselect all</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Row list */}
        {rows.map(row => (
          <TouchableOpacity
            key={row.id}
            style={[
              styles.rowCard,
              glassPanel,
              !row.valid && styles.rowCardInvalid,
              row.valid && row.selected && styles.rowCardSelected,
            ]}
            onPress={() => row.valid && toggleRow(row.id)}
            activeOpacity={row.valid ? 0.8 : 1}
          >
            {/* Checkbox */}
            <View style={[
              styles.checkbox,
              !row.valid && styles.checkboxInvalid,
              row.valid && row.selected && styles.checkboxSelected,
            ]}>
              {row.valid && row.selected && <Ionicons name="checkmark" size={14} color={colors.onPrimary} />}
              {!row.valid && <Ionicons name="close" size={14} color={colors.error} />}
            </View>

            {/* Category icon */}
            <View style={styles.catIcon}>
              <Text style={{ fontSize: 18 }}>{matchCategoryIcon(row.category)}</Text>
            </View>

            {/* Details */}
            <View style={styles.rowDetails}>
              <Text style={styles.rowTitle} numberOfLines={1}>{row.title}</Text>
              <Text style={styles.rowMeta}>
                {row.valid ? formatDate(row.date) : row.errors.join(', ')} · {row.category}
              </Text>
            </View>

            {/* Amount */}
            <Text style={[styles.rowAmount, !row.valid && { color: colors.error }]}>
              ₹{row.amount > 0 ? row.amount.toLocaleString('en-IN') : '?'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sticky import footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.footerInfo}>
          <Text style={styles.footerLabel}>Selected</Text>
          <Text style={styles.footerCount}>{selectedRows.length} of {validCount} rows</Text>
        </View>
        <TouchableOpacity
          style={[styles.importBtn, (importing || selectedRows.length === 0) && { opacity: 0.6 }]}
          onPress={handleImport}
          disabled={importing || selectedRows.length === 0}
          activeOpacity={0.85}
        >
          {importing
            ? <ActivityIndicator size="small" color={colors.onPrimary} />
            : <Ionicons name="cloud-upload-outline" size={18} color={colors.onPrimary} />
          }
          <Text style={styles.importBtnText}>
            {importing ? 'Importing…' : `Import ${selectedRows.length}`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    padding: spacing.pagePadding,
    gap: spacing.md,
  },
  headerSection: {
    gap: 4,
  },
  pageTitle: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.primary,
  },
  pageSubtitle: {
    fontSize: fontSizes.sm,
    color: colors.onSurfaceVariant,
  },
  dropZone: {
    borderRadius: radius.xl,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary + '40',
    backgroundColor: colors.primary + '08',
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  dropIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropTitle: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.primary,
  },
  dropSubtitle: {
    fontSize: fontSizes.xs,
    color: colors.onSurfaceVariant,
  },
  infoCard: {
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  infoTitle: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  table: {
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.outlineVariant + '30',
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant + '20',
  },
  tableHeaderRow: {
    backgroundColor: colors.bgSurfaceContainer,
    borderTopWidth: 0,
  },
  tableCell: {
    flex: 1,
    fontSize: fontSizes.xs,
    color: colors.onSurfaceVariant,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  tableHeaderCell: {
    fontWeight: fontWeights.bold,
    color: colors.primary,
  },
  infoNote: {
    fontSize: fontSizes.xs,
    color: colors.onSurfaceVariant,
  },
  // Done step
  doneContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  doneIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.secondary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
    color: colors.primary,
  },
  doneSubtitle: {
    fontSize: fontSizes.sm,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    height: 48,
    paddingHorizontal: spacing.xl,
    width: '100%',
    ...shadows.card,
  },
  primaryBtnText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.onPrimary,
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    height: 48,
    paddingHorizontal: spacing.xl,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  secondaryBtnText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  // Preview step
  summaryBar: {
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryCol: {
    alignItems: 'center',
    flex: 1,
  },
  summaryNum: {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
    color: colors.primary,
  },
  summaryLabel: {
    fontSize: fontSizes.xs,
    color: colors.onSurfaceVariant,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.outlineVariant + '40',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  fileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  fileName: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
    flex: 1,
  },
  changeFile: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.primary,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  selectCount: {
    fontSize: fontSizes.xs,
    color: colors.onSurfaceVariant,
  },
  selectBtns: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  selectAll: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  deselectAll: {
    fontSize: fontSizes.xs,
    color: colors.onSurfaceVariant,
  },
  rowCard: {
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowCardInvalid: {
    opacity: 0.55,
    borderColor: colors.error + '30',
    backgroundColor: colors.error + '08',
  },
  rowCardSelected: {
    borderColor: colors.primary + '40',
    backgroundColor: colors.primary + '06',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxInvalid: {
    backgroundColor: colors.error + '20',
    borderColor: colors.error + '40',
  },
  catIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.bgSurfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowDetails: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  rowMeta: {
    fontSize: fontSizes.xs,
    color: colors.onSurfaceVariant,
  },
  rowAmount: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.primary,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(248,249,250,0.95)',
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant + '30',
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  footerInfo: {
    flex: 1,
  },
  footerLabel: {
    fontSize: fontSizes.xs,
    color: colors.onSurfaceVariant,
  },
  footerCount: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.primary,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    height: 44,
    paddingHorizontal: spacing.lg,
    ...shadows.card,
  },
  importBtnText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.onPrimary,
  },
});
