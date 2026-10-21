import { UploadCloud, Film } from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';

export const VideosPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Video Catalog & Ingestion</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage long-form videos and inspect speech transcription and visual frame extraction jobs.
          </p>
        </div>
      </div>

      {/* Upload Dropzone Preview */}
      <Card
        title="Upload Video"
        subtitle="Supported formats: MP4, MKV, MOV, WebM (Max 500MB)"
      >
        <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-xl p-8 text-center transition-all bg-slate-950/40">
          <div className="w-12 h-12 rounded-full bg-indigo-950/60 border border-indigo-800/60 text-indigo-400 flex items-center justify-center mx-auto mb-3">
            <UploadCloud className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-200">Drag and drop your video file here</h4>
          <p className="text-xs text-slate-400 mt-1 mb-4">
            Video upload, validation, and FFprobe preprocessing will be implemented in Phase 2.
          </p>
          <Button variant="secondary" size="sm" disabled>
            Select Video File
          </Button>
        </div>
      </Card>

      {/* Videos List placeholder */}
      <div>
        <h3 className="text-base font-semibold text-slate-200 mb-3">Indexed Videos</h3>
        <EmptyState
          title="No Videos Uploaded Yet"
          description="Your uploaded videos, processing pipelines, and transcript summaries will appear here in Phase 2."
          icon={Film}
        />
      </div>
    </div>
  );
};
