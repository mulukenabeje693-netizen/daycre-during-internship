import React, { useState } from 'react';
import { Play, Clock, X } from 'lucide-react';

const videos = [
  {
    title: 'Portal Overview',
    desc: 'A complete walkthrough of the DaycareHQ portal.',
    duration: '4:32',
    gradient: 'from-violet-500 to-purple-700',
    // Using publicly embeddable YouTube demo videos (educational content)
    youtubeId: 'dQw4w9WgXcQ', // placeholder — replace with real tutorial IDs
  },
  {
    title: 'Attendance Tutorial',
    desc: 'How to record and manage daily attendance efficiently.',
    duration: '3:18',
    gradient: 'from-teal-500 to-emerald-700',
    youtubeId: 'dQw4w9WgXcQ',
  },
  {
    title: 'Daily Reports',
    desc: 'Step-by-step guide to creating child activity reports.',
    duration: '5:45',
    gradient: 'from-sky-500 to-blue-700',
    youtubeId: 'dQw4w9WgXcQ',
  },
  {
    title: 'Messaging Parents',
    desc: 'Send announcements and direct messages to parents.',
    duration: '2:57',
    gradient: 'from-rose-500 to-pink-700',
    youtubeId: 'dQw4w9WgXcQ',
  },
];

// ── Video Modal ───────────────────────────────────────────────────────────────
const VideoModal = ({ video, onClose }) => {
  if (!video) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-black rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
          aria-label="Close video"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Title bar */}
        <div className="px-5 py-3 bg-slate-900 border-b border-slate-800">
          <p className="text-sm font-semibold text-white">{video.title}</p>
          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {video.duration}
          </p>
        </div>

        {/* Video player — aspect ratio 16:9 */}
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&rel=0`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────
const VideoTutorials = ({ search = '' }) => {
  const [playing, setPlaying] = useState(null);

  const q = search.toLowerCase().trim();
  const filtered = q
    ? videos.filter((v) => v.title.toLowerCase().includes(q) || v.desc.toLowerCase().includes(q))
    : videos;

  if (q && filtered.length === 0) return null;

  return (
    <section>
      {playing && <VideoModal video={playing} onClose={() => setPlaying(null)} />}

      <div className="mb-5">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Video Tutorials</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Watch step-by-step video guides for every feature.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filtered.map((video) => (
          <button
            key={video.title}
            onClick={() => setPlaying(video)}
            className="group bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200/60 dark:border-slate-800 overflow-hidden hover:shadow-xl hover:shadow-teal-500/10 hover:-translate-y-1 transition-all duration-300 text-left"
          >
            {/* Thumbnail */}
            <div className={`relative h-36 bg-gradient-to-br ${video.gradient} flex items-center justify-center`}>
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
              />
              {/* Play button */}
              <div className="relative z-10 w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 group-hover:scale-110 group-hover:bg-white/30 transition-all duration-300 shadow-lg">
                <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
              </div>
              {/* Duration badge */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/40 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-md">
                <Clock className="w-2.5 h-2.5" /> {video.duration}
              </div>
            </div>

            {/* Info */}
            <div className="p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{video.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{video.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};

export default VideoTutorials;
