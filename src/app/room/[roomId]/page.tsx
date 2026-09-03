'use client';

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from 'uuid';
import { Video, VideoOff, Mic, MicOff, User, ArrowLeft, LogIn, AlertCircle } from 'lucide-react';

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const roomId = params.roomId as string || uuidv4();
  const initialName = searchParams.get("name") || "";
  const initialCamera = searchParams.get("camera") === "true";
  const initialAudio = searchParams.get("audio") !== "false"; // default true

  const [name, setName] = useState(initialName);
  const [cameraOn, setCameraOn] = useState(initialCamera);
  const [audioOn, setAudioOn] = useState(initialAudio);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // Error message auto-hide
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Camera effect
  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Error accessing camera:", err);
        setErrorMessage("Failed to access camera");
      }
    };

    if (cameraOn) {
      startCamera();
    } else {
      // Stop camera tracks if turned off
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    }

    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [cameraOn]);

  // Microphone effect
  useEffect(() => {
    const startAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        audioStreamRef.current = stream;

        // Mute/unmute tracks based on audioOn
        stream.getAudioTracks().forEach(track => track.enabled = audioOn);
      } catch (err) {
        console.error("Error accessing microphone:", err);
        setErrorMessage("Failed to access microphone");
      }
    };

    if (audioOn) {
      if (!audioStreamRef.current) startAudio();
      else audioStreamRef.current.getAudioTracks().forEach(track => track.enabled = true);
    } else {
      audioStreamRef.current?.getAudioTracks().forEach(track => track.enabled = false);
    }

    return () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
    };
  }, [audioOn]);

  const handleJoin = () => {
    if (!name.trim()) {
      setErrorMessage("Please enter your name");
      return;
    }

    // Navigate to meeting page with media state
    router.push(
      `/meeting/${roomId}?name=${encodeURIComponent(name)}&camera=${cameraOn}&audio=${audioOn}`
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="flex flex-col items-center justify-center min-h-screen px-6 py-10">
        {/* Header */}
        <div className="w-full max-w-5xl mb-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="group flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-white/10 transition-all duration-200 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-200" />
            <span className="text-sm text-gray-300">Back</span>
          </button>
        </div>

        {/* Main Content */}
        <div className="w-full max-w-5xl">
          {/* Title */}
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-semibold text-gray-100 mb-3">
              Join Meeting
            </h1>
            <div className="h-1 w-16 bg-indigo-500 mx-auto rounded-full mb-5"></div>
            <p className="text-gray-400 text-sm">
              Room ID{' '}
              <span className="text-gray-300 font-mono bg-white/5 border border-white/5 px-2 py-0.5 rounded-lg">
                {roomId}
              </span>
            </p>
          </div>

          {/* Name Input */}
          <div className="mb-8">
            <div className="max-w-md mx-auto">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                <User className="inline w-4 h-4 mr-2 -mt-0.5" />
                Your Name
              </label>
              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:border-indigo-500/50 text-white placeholder-gray-500 transition-all duration-200"
                autoFocus
              />
            </div>
          </div>

          {/* Camera & Audio Controls */}
          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            {/* Camera Preview */}
            <div className="lg:col-span-2">
              <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center">
                <Video className="w-4 h-4 mr-2" />
                Camera Preview
              </h3>
              <div className="relative bg-[#12121f] border border-white/5 rounded-2xl overflow-hidden h-80 md:h-96">
                {cameraOn ? (
                  <>
                    <video ref={videoRef} autoPlay muted className="w-full h-full object-cover" />
                    <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 backdrop-blur-sm rounded-full border border-emerald-500/20">
                      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
                      <span className="text-xs text-emerald-400 font-medium">Camera on</span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                    <div className="p-5 bg-white/5 rounded-full border border-white/10 mb-4">
                      <VideoOff className="w-10 h-10" />
                    </div>
                    <p className="text-base font-medium text-gray-300">Camera is off</p>
                    <p className="text-sm text-gray-500 mt-1">Turn it on below to preview yourself</p>
                  </div>
                )}
              </div>
            </div>

            {/* Controls Panel */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-400">Meeting Settings</h3>

              {/* Audio Control */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {audioOn ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4 text-red-400" />}
                    <div>
                      <p className="font-medium text-sm text-gray-200">Microphone</p>
                      <p className="text-xs text-gray-500">Computer audio</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={audioOn}
                      onChange={() => setAudioOn(!audioOn)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:bg-indigo-500 transition-all duration-200"></div>
                    <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-5 transition-all duration-200 shadow"></span>
                  </label>
                </div>
                <div className="text-xs text-gray-500">
                  {audioOn ? "Microphone will be enabled" : "Microphone will be muted"}
                </div>
              </div>

              {/* Camera Control */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {cameraOn ? <Video className="w-4 h-4 text-emerald-400" /> : <VideoOff className="w-4 h-4 text-red-400" />}
                    <div>
                      <p className="font-medium text-sm text-gray-200">Camera</p>
                      <p className="text-xs text-gray-500">Video feed</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCameraOn(!cameraOn)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 active:scale-95 border ${
                      cameraOn
                        ? "bg-white/5 hover:bg-white/10 text-white border-white/10"
                        : "bg-red-500/80 hover:bg-red-500 text-white border-red-500/30"
                    }`}
                  >
                    {cameraOn ? "Turn Off" : "Turn On"}
                  </button>
                </div>
                <div className="text-xs text-gray-500">
                  {cameraOn ? "Camera is active" : "Camera is disabled"}
                </div>
              </div>

              {/* Join Button */}
              <button
                onClick={handleJoin}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-semibold text-sm transition-all duration-200 active:scale-95 border border-indigo-500/30"
              >
                <LogIn className="w-4 h-4" />
                Join Meeting
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/90 backdrop-blur-sm border border-red-400/20 rounded-2xl shadow-2xl">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">{errorMessage}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}