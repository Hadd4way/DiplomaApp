import * as React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export type ExportFormat = 'markdown' | 'json';

type Props = {
  open: boolean;
  loading: boolean;
  format: ExportFormat;
  preview: string;
  error?: string | null;
  message?: string | null;
  onFormatChange: (format: ExportFormat) => void;
  onCopy: () => void;
  onSave: () => void;
  onClose: () => void;
};

export function ExportDialog({
  open,
  loading,
  format,
  preview,
  error,
  message,
  onFormatChange,
  onCopy,
  onSave,
  onClose
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => (nextOpen ? undefined : onClose())}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Export Book Data</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="space-y-3">
          <label className="block text-sm text-slate-700" htmlFor="export-format">
            Format
          </label>
          <select
            id="export-format"
            value={format}
            onChange={(event) => onFormatChange(event.target.value === 'json' ? 'json' : 'markdown')}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={loading}
          >
            <option value="markdown">Markdown</option>
            <option value="json">JSON</option>
          </select>
          <p className="text-xs text-slate-600">Preview (first 40 lines)</p>
          <pre className="max-h-64 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700 whitespace-pre-wrap">
            {preview || 'No data'}
          </pre>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Close
          </Button>
          <Button type="button" variant="outline" onClick={onCopy} disabled={loading}>
            Copy
          </Button>
          <Button type="button" onClick={onSave} disabled={loading}>
            Save
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
