'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Bookmark, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

function AddContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const url = searchParams.get('url') || searchParams.get('text');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Salvataggio articolo in corso...');

  useEffect(() => {
    if (!url) {
      setStatus('error');
      setMessage('Nessun URL specificato da salvare.');
      return;
    }

    // Try extracting valid URL from text if shared text contains URL
    let targetUrl = url;
    try {
      const match = url.match(/https?:\/\/[^\s]+/);
      if (match) targetUrl = match[0];
      new URL(targetUrl);
    } catch {
      setStatus('error');
      setMessage('URL non valido.');
      return;
    }

    async function save() {
      try {
        const res = await fetch('/api/articles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: targetUrl }),
        });

        const data = await res.json();
        if (res.status === 401 && data.authRequired) {
          setStatus('error');
          setMessage('Accesso richiesto. Accedi a PocketBox prima di salvare.');
          setTimeout(() => router.push('/'), 2000);
          return;
        }

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Errore durante il salvataggio');
        }

        setStatus('success');
        setMessage(data.article?.title ? `Salvato: "${data.article.title}"` : 'Articolo salvato con successo!');
        setTimeout(() => {
          router.push('/');
        }, 1200);
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'Errore imprevisto.');
      }
    }

    save();
  }, [url, router]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-slate-950 text-slate-100">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
        <div className="w-14 h-14 mx-auto mb-4 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20">
          <Bookmark className="w-8 h-8 text-white fill-current" />
        </div>

        <h1 className="text-xl font-bold text-white mb-2">PocketBox</h1>

        <div className="py-6 flex flex-col items-center justify-center gap-3">
          {status === 'loading' && (
            <>
              <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
              <p className="text-sm text-slate-300">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-8 h-8 text-emerald-400" />
              <p className="text-sm font-medium text-emerald-300">{message}</p>
              <p className="text-xs text-slate-500">Reindirizzamento all'archivio...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p className="text-sm text-red-300">{message}</p>
              <button
                onClick={() => router.push('/')}
                className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-white rounded-lg transition"
              >
                Torna a PocketBox
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AddPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[100dvh] flex items-center justify-center bg-slate-950 text-white">
        <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
      </div>
    }>
      <AddContent />
    </Suspense>
  );
}
