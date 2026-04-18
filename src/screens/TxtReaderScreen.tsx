import * as React from 'react';
import { FlowDocumentReader } from '@/components/reader/FlowDocumentReader';
import { parseTxtDocument } from '@/lib/txt';

type Props = {
  title: string;
  bookId: string;
  initialCfi?: string | null;
  onInitialCfiApplied?: () => void;
  loading: boolean;
  onBack: () => void;
};

export function TxtReaderScreen({ title, bookId, initialCfi = null, onInitialCfiApplied, loading, onBack }: Props) {
  const loadDocument = React.useCallback(async (currentBookId: string) => {
    if (!window.api?.books) {
      throw new Error('Renderer API is unavailable. Open this app via Electron.');
    }

    const txtResult = await window.api.books.getTxtData({ bookId: currentBookId });
    if (!txtResult.ok) {
      throw new Error(txtResult.error);
    }

    return parseTxtDocument(txtResult.content, txtResult.title || title);
  }, [title]);

  return (
    <FlowDocumentReader
      title={title}
      bookId={bookId}
      format="txt"
      namespace="txt"
      initialCfi={initialCfi}
      onInitialCfiApplied={onInitialCfiApplied}
      loading={loading}
      onBack={onBack}
      loadDocument={loadDocument}
      searchPlaceholder="Search in this TXT..."
      loadingLabel="Loading TXT..."
      preparingLabel="Preparing TXT document..."
      openErrorLabel="Unable to open TXT"
      navLabelSingular="Section"
      navLabelPlural="sections"
    />
  );
}
