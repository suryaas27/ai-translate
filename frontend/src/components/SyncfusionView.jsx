import { useRef, useEffect, useState } from 'react';
import { registerLicense } from '@syncfusion/ej2-base';
import { DocumentEditorContainerComponent, Toolbar } from '@syncfusion/ej2-react-documenteditor';
import '@syncfusion/ej2-react-documenteditor/styles/material.css';

registerLicense('Ngo9BigBOggjHTQxAR8/V1NNaF5cXmBCf1FpRmJGdld5fUVHYVZUTXxaS00DNHVRdkdmWXpccXRQRGRYU0VzWUJWYE4=');

DocumentEditorContainerComponent.Inject(Toolbar);

const SERVICE_URL = 'https://document.syncfusion.com/web-services/docx-editor/api/documenteditor/';
const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;
const DEFAULT_ZOOM = 1.0;

const SyncfusionView = ({ docxB64, height = '80vh' }) => {
    const containerRef = useRef(null);
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState(null);
    const [zoom, setZoom] = useState(DEFAULT_ZOOM);

    const getEditor = () => containerRef.current?.documentEditor;

    const openDocument = (sfdt) => {
        const editor = getEditor();
        if (editor) {
            editor.open(JSON.stringify(sfdt));
        }
    };

    const applyZoom = (newZoom) => {
        const editor = getEditor();
        if (editor) {
            editor.zoomFactor = newZoom;
        }
        setZoom(newZoom);
    };

    const handleZoomIn = () => {
        const newZoom = Math.min(parseFloat((zoom + ZOOM_STEP).toFixed(1)), MAX_ZOOM);
        applyZoom(newZoom);
    };

    const handleZoomOut = () => {
        const newZoom = Math.max(parseFloat((zoom - ZOOM_STEP).toFixed(1)), MIN_ZOOM);
        applyZoom(newZoom);
    };

    const handleZoomReset = () => applyZoom(DEFAULT_ZOOM);

    useEffect(() => {
        if (!docxB64) return;

        setImporting(true);
        setImportError(null);

        const byteCharacters = atob(docxB64);
        const byteNumbers = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const blob = new Blob([byteNumbers], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });

        const formData = new FormData();
        formData.append('files', blob, 'document.docx');

        fetch(`${SERVICE_URL}Import`, {
            method: 'POST',
            body: formData,
        })
            .then((res) => {
                if (!res.ok) throw new Error(`Service responded with ${res.status}`);
                return res.json();
            })
            .then((sfdt) => {
                setImporting(false);
                setTimeout(() => {
                    openDocument(sfdt);
                    // Reset zoom to default on new document
                    const editor = getEditor();
                    if (editor) editor.zoomFactor = DEFAULT_ZOOM;
                    setZoom(DEFAULT_ZOOM);
                }, 100);
            })
            .catch((err) => {
                console.error('Syncfusion import error:', err);
                setImporting(false);
                setImportError(err.message || 'Failed to load document');
            });
    }, [docxB64]);

    const zoomPct = Math.round(zoom * 100);

    return (
        <div className="flex flex-col w-full" style={{ height }}>
            {/* Zoom toolbar */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 border-b border-gray-200 shrink-0">
                <span className="text-xs text-gray-500 font-medium mr-1">Zoom</span>
                <button
                    onClick={handleZoomOut}
                    disabled={zoom <= MIN_ZOOM}
                    title="Zoom out"
                    className="w-7 h-7 flex items-center justify-center rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-base font-bold leading-none"
                >
                    −
                </button>
                <button
                    onClick={handleZoomReset}
                    title="Reset to 100%"
                    className="min-w-[52px] h-7 px-2 text-xs font-mono font-semibold rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                    {zoomPct}%
                </button>
                <button
                    onClick={handleZoomIn}
                    disabled={zoom >= MAX_ZOOM}
                    title="Zoom in"
                    className="w-7 h-7 flex items-center justify-center rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-base font-bold leading-none"
                >
                    +
                </button>
            </div>

            {/* Editor area */}
            <div className="relative flex-1 min-h-0">
                {importing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                        <div className="flex flex-col items-center gap-2 text-indigo-600">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
                            <span className="text-sm font-medium">Loading document...</span>
                        </div>
                    </div>
                )}
                {importError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-10">
                        <div className="text-center text-red-600 p-4">
                            <p className="font-medium">Failed to load document</p>
                            <p className="text-sm mt-1 text-red-400">{importError}</p>
                        </div>
                    </div>
                )}
                <DocumentEditorContainerComponent
                    ref={containerRef}
                    height="100%"
                    serviceUrl={SERVICE_URL}
                    enableToolbar={false}
                    restrictEditing={true}
                    enableComment={false}
                    enableTrackChanges={false}
                    enablePrint={true}
                />
            </div>
        </div>
    );
};

export default SyncfusionView;
