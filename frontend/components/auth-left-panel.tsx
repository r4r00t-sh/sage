'use client';

import { useEffect, useState } from 'react';

const UNICORN_PROJECT_ID = 'ySJkiD7lWeqjLi9y0qYh';
const UNICORN_SDK_URL = 'https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.0.5/dist/unicornStudio.umd.js';

/** Only mount Unicorn scene once per page load to avoid "Scene already initialized" when React Strict Mode double-mounts. */
let unicornSceneMounted = false;

export function AuthLeftPanel() {
  const [UnicornScene, setUnicornScene] = useState<React.ComponentType<{
    projectId: string;
    sdkUrl: string;
    width: string;
    height: string;
  }> | null>(null);

  useEffect(() => {
    import('unicornstudio-react/next').then((mod) => setUnicornScene(() => mod.default));
  }, []);

  const shouldMountScene = UnicornScene && !unicornSceneMounted;

  useEffect(() => {
    return () => {
      if (UnicornScene) unicornSceneMounted = true;
    };
  }, [UnicornScene]);

  return (
    <div className="relative w-full h-full min-h-[50vh] lg:min-h-screen overflow-hidden">
      {/* Unicorn Studio WebGL scene - mount once to avoid double-init in dev (Strict Mode). */}
      <div className="absolute inset-0 w-full h-full bg-zinc-900">
        {shouldMountScene ? (
          <UnicornScene
            projectId={UNICORN_PROJECT_ID}
            sdkUrl={UNICORN_SDK_URL}
            width="100%"
            height="100%"
          />
        ) : UnicornScene ? (
          <div className="w-full h-full bg-zinc-900" aria-hidden />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-900" />
        )}
      </div>

      {/* Acrylic blur overlay - hover to show full form, default shows SAGE */}
      <div
        className="group absolute inset-2 lg:inset-3 rounded-2xl flex items-center justify-center overflow-hidden cursor-default"
        style={{
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="relative w-full max-w-xl px-6 py-10 flex flex-col items-center justify-center min-h-[180px]">
          <span
            className="audiowide-regular absolute inset-0 flex items-center justify-center text-center text-6xl sm:text-7xl lg:text-8xl xl:text-9xl font-black text-white tracking-tight opacity-100 group-hover:opacity-0 transition-opacity duration-300"
            style={{
              textShadow: '0 2px 24px rgba(0,0,0,0.4), 0 0 40px rgba(0,0,0,0.2)',
            }}
          >
            SAGE
          </span>
          <span
            className="font-funnel absolute inset-0 flex flex-col items-center justify-center text-center text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-extrabold text-white/95 tracking-tight px-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              textShadow: '0 2px 24px rgba(0,0,0,0.4), 0 0 40px rgba(0,0,0,0.2)',
            }}
          >
            <span className="whitespace-nowrap">Santhigiri Administration</span>
            <span className="whitespace-nowrap">And Governance Engine</span>
          </span>
        </div>
      </div>
    </div>
  );
}
