'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import { Video, Users, Shield, Zap, ArrowRight } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  const handleGetStarted = useCallback(() => {
    const roomId = uuidv4();
    router.push(`/room/${roomId}`);
  }, [router]);

  const biniLogo = useMemo(() => ({
    src: '/logo.png',
    alt: 'Bini Logo',
    width: 420,
    height: 105,
  }), []);

  const features = [
    {
      icon: <Video className="w-5 h-5" />,
      title: "HD Video Calls",
      description: "Crystal clear video quality for professional meetings"
    },
    {
      icon: <Users className="w-5 h-5" />,
      title: "Team Collaboration",
      description: "Seamless collaboration tools for productive teamwork"
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: "Secure & Private",
      description: "End-to-end encryption keeps your meetings safe"
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Lightning Fast",
      description: "Optimized performance for smooth meeting experience"
    }
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-10 text-center">
        {/* Logo section - main header, very large */}
        <div className="mb-12 transform hover:scale-105 transition-transform duration-300">
          <Image {...biniLogo} className="brightness-0 invert" />
        </div>

        {/* Hero section - no purple line */}
        <div className="max-w-4xl mx-auto mb-16">
          <p className="text-xl md:text-2xl text-gray-400 mb-12 leading-relaxed max-w-3xl">
            Experience the future of online collaboration with our lightweight, secure, and lightning-fast meeting platform. 
            <span className="text-indigo-300 font-medium"> Connect instantly</span> and 
            <span className="text-indigo-300 font-medium"> collaborate seamlessly</span> with your team.
          </p>

          {/* CTA Button */}
          <button
            onClick={handleGetStarted}
            className="group relative px-12 py-5 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-xl font-semibold transform hover:scale-105 hover:shadow-2xl hover:shadow-indigo-500/20 transition-all duration-200 active:scale-95 border border-indigo-500/30"
          >
            <span className="relative z-10 flex items-center gap-2">
              Get Started Now
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
            </span>
          </button>
        </div>

        {/* Features grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="group p-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:bg-white/10 hover:border-white/20 transform hover:scale-105 hover:-translate-y-1 transition-all duration-300"
            >
              <div className="flex flex-col items-center text-center">
                <div className="p-3 bg-white/5 rounded-xl mb-4 group-hover:bg-indigo-500/20 transition-all duration-300 border border-white/5 group-hover:border-indigo-500/30">
                  <div className="text-indigo-400 group-hover:text-indigo-300 transition-colors duration-300">
                    {feature.icon}
                  </div>
                </div>
                <h3 className="text-base font-medium mb-2 text-gray-200 group-hover:text-white transition-colors duration-300">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-500 group-hover:text-gray-400 transition-colors duration-300">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Static decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-2 h-2 bg-white/5 rounded-full animate-pulse delay-1000"></div>
        <div className="absolute top-40 right-32 w-1 h-1 bg-indigo-300/10 rounded-full animate-pulse delay-2000"></div>
        <div className="absolute bottom-32 left-40 w-1.5 h-1.5 bg-indigo-300/10 rounded-full animate-pulse delay-500"></div>
        <div className="absolute bottom-20 right-20 w-1 h-1 bg-white/5 rounded-full animate-pulse delay-3000"></div>
        <div className="absolute top-1/2 left-10 w-1 h-1 bg-indigo-400/10 rounded-full animate-pulse delay-1500"></div>
        <div className="absolute top-1/3 right-10 w-2 h-2 bg-indigo-400/10 rounded-full animate-pulse delay-2500"></div>
      </div>
    </div>
  );
}