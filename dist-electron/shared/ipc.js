"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.READER_SETTINGS_DEFAULTS = exports.IPC_CHANNELS = void 0;
exports.IPC_CHANNELS = {
    ping: 'app:ping',
    booksList: 'books:list',
    booksAddSample: 'books:add-sample',
    booksImport: 'books:import',
    booksReveal: 'books:reveal',
    booksDelete: 'books:delete',
    booksGetPdfData: 'books:get-pdf-data',
    booksGetEpubData: 'books:get-epub-data',
    notesCreate: 'notes:create',
    notesList: 'notes:list',
    notesDelete: 'notes:delete',
    notesUpdate: 'notes:update',
    highlightsList: 'highlights:list',
    highlightsCreateMerged: 'highlights:create-merged',
    highlightsDelete: 'highlights:delete',
    highlightsInsertRaw: 'highlights:insert-raw',
    bookmarksList: 'bookmarks:list',
    bookmarksToggle: 'bookmarks:toggle',
    bookmarksRemove: 'bookmarks:remove',
    exportGetBookData: 'export:get-book-data',
    exportSaveFile: 'export:save-file',
    epubProgressGet: 'epub-progress:get',
    epubProgressSet: 'epub-progress:set',
    readerSettingsGet: 'reader-settings:get',
    readerSettingsUpdate: 'reader-settings:update',
    progressGetLastPage: 'progress:get-last-page',
    progressSetLastPage: 'progress:set-last-page',
    statsMarkOpened: 'stats:mark-opened',
    statsGetRecentBooks: 'stats:get-recent-books'
};
exports.READER_SETTINGS_DEFAULTS = {
    theme: 'light',
    epubFontSize: 100,
    epubLineHeight: 1.6
};
