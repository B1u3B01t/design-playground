import PdfViewerClient from './PdfViewerClient';
import { parsePdfViewerPages } from '../lib/pdf-utils';

export const dynamic = 'force-dynamic';

export default async function PdfViewerPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string; name?: string; pages?: string }>;
}) {
  const { url, name, pages: pagesRaw } = await searchParams;
  const pdfUrl = typeof url === 'string' ? url : '';
  const displayName = typeof name === 'string' && name.trim() ? name.trim() : 'PDF';
  const pages = parsePdfViewerPages(pagesRaw);

  if (!pdfUrl) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-stone-100 text-stone-500 text-sm">
        Missing PDF URL
      </div>
    );
  }

  return <PdfViewerClient pdfUrl={pdfUrl} name={displayName} pages={pages} />;
}
