"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPC_CHANNELS = void 0;
exports.IPC_CHANNELS = {
    ping: 'app:ping',
    authSignUp: 'auth:sign-up',
    authSignIn: 'auth:sign-in',
    authGetCurrentUser: 'auth:get-current-user',
    authSignOut: 'auth:sign-out',
    booksList: 'books:list',
    booksAddSample: 'books:add-sample',
    booksImport: 'books:import',
    booksReveal: 'books:reveal',
    booksDelete: 'books:delete',
    booksGetPdfData: 'books:get-pdf-data',
    notesCreate: 'notes:create',
    notesList: 'notes:list',
    notesDelete: 'notes:delete',
    notesUpdate: 'notes:update',
    highlightsList: 'highlights:list',
    highlightsCreateMerged: 'highlights:create-merged',
    highlightsDelete: 'highlights:delete',
    highlightsInsertRaw: 'highlights:insert-raw',
    progressGetLastPage: 'progress:get-last-page',
    progressSetLastPage: 'progress:set-last-page'
};
