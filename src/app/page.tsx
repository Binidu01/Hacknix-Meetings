'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import { Video, MessageSquare, Monitor, Shield, Mic, PhoneOff, ArrowRight, Clock, Copy } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  const handleGetStarted = useCallback(() => {
    const roomId = uuidv4();
    router.push(`/room/${roomId}`);
  }, [router]);

  const capabilities = [
    {
      icon: <Video className="w-4 h-4" />,
      title: "Multi-party video",
      description: "Powered by a WebRTC SFU, so calls stay smooth."
    },
    {
      icon: <Monitor className="w-4 h-4" />,
      title: "Screen sharing",
      description: "Share a window or tab, with system audio when you need it."
    },
    {
      icon: <MessageSquare className="w-4 h-4" />,
      title: "In-call chat",
      description: "Send a message to the room without interrupting the call."
    },
    {
      icon: <Shield className="w-4 h-4" />,
      title: "Encrypted by default",
      description: "Every call runs over an encrypted WebRTC connection."
    }
  ];

  // Static preview of the real gallery UI — not decorative, this mirrors
  // the actual call screen (see the meeting page grid/controls).
  const previewTiles = [
    { initial: 'A', color: '#4f46e5' },
    { initial: 'J', color: '#0891b2' },
    { initial: 'M', color: '#7c3aed' },
    { initial: 'T', color: '#334155' },
  ];

  return (
    <div className="fixed inset-0 bg-[#0a0a0f] text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 sm:px-10 py-3 max-w-6xl mx-auto w-full flex-shrink-0">
        <div className="relative w-[110px] h-[37px]">
          <Image
            src="/logo.png"
            alt="Bini Logo"
            fill
            className="object-cover brightness-0 invert"
          />
        </div>
        <button
          onClick={handleGetStarted}
          className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200 active:scale-95"
        >
          Start a meeting
        </button>
      </header>

      {/* Main content, vertically centered in the remaining space */}
      <main className="flex-1 flex flex-col justify-center min-h-0 px-6 sm:px-10 max-w-6xl mx-auto w-full">
        {/* Hero */}
        <section className="grid lg:grid-cols-2 gap-10 items-center mb-8">
          {/* Copy */}
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gray-50 leading-[1.1] mb-4">
              Video meetings that just work.
            </h1>
            <p className="text-sm sm:text-base text-gray-400 leading-relaxed mb-6 max-w-md">
              Start a call, share the link, and talk. No accounts and nothing
              to install — just open the room in your browser.
            </p>

            <div className="flex items-center gap-4">
              <button
                onClick={handleGetStarted}
                className="group inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-sm font-semibold transition-all duration-200 active:scale-95 border border-indigo-500/30"
              >
                Start a meeting
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
              </button>
              <span className="text-sm text-gray-500">No sign-up required</span>
            </div>
          </div>

          {/* Product preview */}
          <div className="rounded-2xl border border-white/10 bg-[#0d0d14] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                04:12
              </div>
              <span className="text-xs text-gray-600 font-mono">room-2f8a91</span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3">
              {previewTiles.map((tile) => (
                <div
                  key={tile.initial}
                  className="aspect-video rounded-lg flex items-center justify-center text-sm font-semibold text-white/90"
                  style={{ background: `linear-gradient(145deg, ${tile.color}, #14141f)` }}
                >
                  {tile.initial}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2 px-4 py-2.5 border-t border-white/5">
              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-300">
                <Mic size={14} />
              </div>
              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-300">
                <Video size={14} />
              </div>
              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-300">
                <MessageSquare size={14} />
              </div>
              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-300">
                <Copy size={14} />
              </div>
              <div className="w-8 h-8 rounded-full bg-red-500/80 flex items-center justify-center text-white">
                <PhoneOff size={14} />
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities */}
        <section className="max-w-4xl w-full mt-14">
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-8">
            {capabilities.map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10"
              >
                <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-indigo-400 flex-shrink-0">
                  {item.icon}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-100 mb-1">{item.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}