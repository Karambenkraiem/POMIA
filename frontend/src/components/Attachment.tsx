import { useEffect, useState } from 'react';
import { FileText, Download } from 'lucide-react';
import { getAttachmentBlob } from '../lib/api';

interface Props {
  url: string;
  nom?: string | null;
  type?: string | null;
}

export default function Attachment({ url, nom, type }: Props) {
  const isImage = !!type?.startsWith('image/');
  const isVideo = !!type?.startsWith('video/');
  const isPreviewable = isImage || isVideo;
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(isPreviewable);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isPreviewable) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    setLoading(true);
    getAttachmentBlob(url)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false); } });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, isPreviewable]);

  async function openFile() {
    try {
      const blob = await getAttachmentBlob(url);
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch {
      setError(true);
    }
  }

  if (isPreviewable) {
    if (loading) return <div className="w-40 h-28 bg-slate-800 rounded-lg animate-pulse" />;
    if (error || !blobUrl) return <p className="text-xs text-red-400">Fichier indisponible</p>;
    if (isVideo) {
      return (
        <video
          src={blobUrl}
          controls
          className="max-w-[260px] max-h-56 rounded-lg border border-slate-700"
        />
      );
    }
    return (
      <button onClick={openFile} className="block" title="Ouvrir l'image">
        <img
          src={blobUrl}
          alt={nom || 'pièce jointe'}
          className="max-w-[240px] max-h-56 rounded-lg border border-slate-700 object-contain"
        />
      </button>
    );
  }

  return (
    <button
      onClick={openFile}
      className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-1.5 transition-colors"
    >
      <FileText size={14} className="flex-shrink-0" />
      <span className="truncate max-w-[160px]">{nom || 'Document'}</span>
      <Download size={12} className="flex-shrink-0 opacity-60" />
    </button>
  );
}
