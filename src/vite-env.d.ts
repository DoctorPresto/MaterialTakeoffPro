/// <reference types="vite/client" />

declare module '*?url' {
    const content: string;
    export default content;
}

declare module 'pdfjs-dist/build/pdf.worker.min.mjs?url' {
    const workerSrc: string;
    export default workerSrc;
}