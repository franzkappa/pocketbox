import { Bookmark } from 'lucide-react';

export default function SharedArticleNotFound() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-slate-950 text-slate-100 select-text">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
        <div className="w-12 h-12 mx-auto mb-4 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-center justify-center text-rose-400">
          <Bookmark className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold text-white mb-2">Shared link unavailable</h1>
        <p className="text-xs text-slate-400 leading-relaxed">
          This shared article or newsletter link does not exist or is no longer available.
        </p>
      </div>
    </div>
  );
}
