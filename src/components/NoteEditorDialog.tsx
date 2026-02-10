import * as React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  value: string;
  onValueChange: (value: string) => void;
  error?: string | null;
  saving?: boolean;
  saveLabel?: string;
  onCancel: () => void;
  onSave: () => void;
};

export function NoteEditorDialog({
  open,
  title,
  subtitle,
  value,
  onValueChange,
  error,
  saving = false,
  saveLabel = 'Save',
  onCancel,
  onSave
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => (nextOpen ? undefined : onCancel())}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="space-y-2">
          {subtitle ? <p className="text-sm text-slate-700">{subtitle}</p> : null}
          <textarea
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            className="min-h-28 w-full rounded-md border border-slate-300 p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Write your note..."
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={saving}>
            {saveLabel}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
