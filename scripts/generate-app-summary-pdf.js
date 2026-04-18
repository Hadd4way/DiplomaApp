const fs = require('node:fs');
const path = require('node:path');
const repoRoot = path.resolve(__dirname, '..');
const outputDir = path.join(repoRoot, 'output', 'pdf');
const tmpDir = path.join(repoRoot, 'tmp', 'pdfs');
const pdfPath = path.join(outputDir, 'diplomaapp-summary.pdf');
const previewPath = path.join(tmpDir, 'diplomaapp-summary-preview.png');
const htmlPath = path.join(tmpDir, 'diplomaapp-summary.html');

const content = {
  title: 'DiplomaApp',
  whatItIs:
    'Electron desktop app for managing and reading local PDF and EPUB books. It combines a library view with built-in readers, annotations, bookmarks, export, and saved reading progress.',
  whoItsFor:
    'Primary persona (inferred from repo): a student, researcher, or heavy reader who keeps a personal local library and wants notes, highlights, bookmarks, and quick resume on desktop.',
  features: [
    'Import PDF and EPUB files into a local library, or add sample books.',
    'Open books in built-in PDF and EPUB readers with navigation controls.',
    'Save PDF page progress and EPUB CFI progress, then resume later.',
    'Create, edit, search, and reopen notes from a dedicated Notes screen.',
    'Add bookmarks for PDF pages and EPUB locations.',
    'Create highlights in both readers and attach notes to highlights.',
    'Export a book\'s notes and highlights as Markdown or JSON.'
  ],
  architecture: [
    'Renderer: React 19 + Vite screens/components (`src/`) for library, PDF reader, EPUB reader, notes, and reader settings.',
    'Bridge: `electron/preload.ts` exposes `window.api`; shared request/result types live in `shared/ipc.ts`.',
    'Main process: `electron/main.ts` registers IPC handlers for books, notes, highlights, bookmarks, export, progress, reader settings, and recent books.',
    'Storage: `auth.sqlite` stores books, users/local identity, reader settings, and reading stats; `reader.db` stores progress, notes, highlights, and bookmarks.',
    'Files/data flow: imported books are copied into Electron `userData/books/<bookId>/original.(pdf|epub)`; renderer calls IPC -> Electron services read/write SQLite and local files -> responses return to UI.',
    'External backend/API: Not found in repo.'
  ],
  runSteps: [
    'Run `npm install`.',
    'Run `npm run dev`.',
    'Use the Electron window that opens; renderer dev server runs on port 5173 via Vite.'
  ],
  repoNotes: [
    'README includes only basic dev/build commands.',
    'Automated tests or CI setup: Not found in repo.'
  ]
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function bulletList(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function buildHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(content.title)} Summary</title>
    <style>
      @page {
        size: A4;
        margin: 0.4in 0.5in;
      }
      :root {
        --ink: #132238;
        --muted: #56657a;
        --line: #d6dde6;
        --panel: #f5f7fa;
        --accent: #0f4c81;
        --accent-soft: #e8f1f8;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font-family: "Segoe UI", Arial, sans-serif;
        color: var(--ink);
        background: white;
      }
      .page {
        width: 100%;
        min-height: 100vh;
        padding: 26px 28px 22px;
      }
      .hero {
        display: grid;
        grid-template-columns: 1.35fr 1fr;
        gap: 18px;
        align-items: start;
        margin-bottom: 16px;
      }
      .hero-card {
        background: linear-gradient(135deg, var(--accent-soft), #ffffff 70%);
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 20px 22px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 28px;
        line-height: 1.1;
        letter-spacing: 0.2px;
      }
      .subtitle {
        margin: 0;
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .summary {
        margin: 12px 0 0;
        font-size: 14px;
        line-height: 1.48;
      }
      .persona {
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 18px 18px;
        background: #fff;
      }
      .label {
        margin: 0 0 6px;
        color: var(--accent);
        font-weight: 700;
        font-size: 11px;
        letter-spacing: 0.8px;
        text-transform: uppercase;
      }
      .persona p {
        margin: 0;
        font-size: 13px;
        line-height: 1.48;
      }
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      .panel {
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 16px 18px;
        background: var(--panel);
      }
      .panel h2 {
        margin: 0 0 10px;
        font-size: 13px;
        letter-spacing: 0.7px;
        text-transform: uppercase;
        color: var(--accent);
      }
      ul {
        margin: 0;
        padding-left: 16px;
      }
      li {
        margin: 0 0 7px;
        font-size: 12.3px;
        line-height: 1.4;
      }
      .full {
        margin-top: 16px;
      }
      .full .panel {
        background: #fff;
      }
      .footer {
        margin-top: 12px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .note-box {
        border-top: 1px solid var(--line);
        padding-top: 10px;
        color: var(--muted);
        font-size: 11px;
        line-height: 1.4;
      }
      code {
        font-family: Consolas, "Courier New", monospace;
        font-size: 0.94em;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="hero">
        <section class="hero-card">
          <p class="subtitle">App Summary</p>
          <h1>${escapeHtml(content.title)}</h1>
          <p class="summary">${escapeHtml(content.whatItIs)}</p>
        </section>
        <section class="persona">
          <p class="label">Who It&apos;s For</p>
          <p>${escapeHtml(content.whoItsFor)}</p>
        </section>
      </div>

      <div class="grid">
        <section class="panel">
          <h2>What It Does</h2>
          <ul>${bulletList(content.features)}</ul>
        </section>
        <section class="panel">
          <h2>How To Run</h2>
          <ul>${bulletList(content.runSteps)}</ul>
        </section>
      </div>

      <div class="full">
        <section class="panel">
          <h2>How It Works</h2>
          <ul>${bulletList(content.architecture)}</ul>
        </section>
      </div>

      <div class="footer">
        <div class="note-box">${escapeHtml(content.repoNotes[0])}</div>
        <div class="note-box">${escapeHtml(content.repoNotes[1])}</div>
      </div>
    </div>
  </body>
</html>`;
}

async function ensureDir(dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

async function main() {
  await ensureDir(outputDir);
  await ensureDir(tmpDir);
  await fs.promises.writeFile(htmlPath, buildHtml(), 'utf8');
  console.log(`HTML_PATH=${htmlPath}`);
  console.log(`PDF_PATH=${pdfPath}`);
  console.log(`PREVIEW_PATH=${previewPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
