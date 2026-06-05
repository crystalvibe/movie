import React, { useState } from 'react';
import { Navigation } from '../components/Navigation';
import { Helmet } from 'react-helmet';
import { 
  Info, 
  Lightbulb, 
  ChevronDown, 
  ChevronUp, 
  Shield, 
  Subtitles, 
  RotateCcw, 
  HelpCircle, 
  Keyboard, 
  Activity, 
  Heart,
  Server,
  Globe,
  MonitorPlay,
  Sparkles
} from 'lucide-react';

// Tips and tricks data - focused only on essential and functional information
const tipsData = [
  {
    icon: Subtitles,
    title: "Enabling Subtitles",
    tag: "Playback Guide",
    tagColor: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
    description: "For subtitle support, select VidLink.pro or VidKing.net from the server dropdown. Once the stream loads, click the CC button inside the player controls to select your language."
  },
  {
    icon: RotateCcw,
    title: "Resolving Buffering Issues",
    tag: "Troubleshooting",
    tagColor: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
    description: "If a stream buffers or gets stuck loading, switch to an alternative server (e.g. VidKing or Videasy) from the server dropdown, wait a moment, and switch back. This resets the stream connection."
  },
  {
    icon: HelpCircle,
    title: "Handling 'No Media Found' Errors",
    tag: "Alternative Servers",
    tagColor: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
    description: "If a server displays a 'No Media Found' or loading error, it means the current provider does not host that title. Switch to backup servers like 2Embed or Embed-API Server, which specialize in older or classic content."
  },
  {
    icon: Shield,
    title: "Preventing Third-Party Popup Ads",
    tag: "Recommended",
    tagColor: "bg-rose-500/20 text-rose-300 border border-rose-500/30",
    description: "PULSE cinema itself serves zero ads. However, some external stream hosting providers may attempt to open popups. We strongly recommend using Brave Browser or installing the uBlock Origin extension to block them."
  }
];

const servers = [
  {
    name: "VidLink.pro",
    role: "Primary Server",
    quality: "1080P",
    speed: "Excellent",
    features: ["Auto Subtitles", "Fast Buffer"],
    status: "Stable"
  },
  {
    name: "VidKing.net",
    role: "Backup Server",
    quality: "1080P",
    speed: "Good",
    features: ["Subtitles", "High Reliability"],
    status: "Stable"
  },
  {
    name: "Videasy.net",
    role: "Backup Server",
    quality: "1080P",
    speed: "Good",
    features: ["Multi-host", "Low Ping"],
    status: "Stable"
  },
  {
    name: "2Embed",
    role: "Classic Provider",
    quality: "1080P",
    speed: "Moderate",
    features: ["Older Titles", "Stable"],
    status: "Stable"
  },
  {
    name: "Peachify.pro",
    role: "Alternate Source",
    quality: "1080P",
    speed: "Good",
    features: ["Fast Loads"],
    status: "Stable"
  },
  {
    name: "Embed-API Server",
    role: "Lightweight Backup",
    quality: "720P",
    speed: "Moderate",
    features: ["Fallback Link"],
    status: "Online"
  }
];

const keyboardShortcuts = [
  { keys: ["Space", "K"], action: "Play / Pause Video" },
  { keys: ["F"], action: "Toggle Fullscreen mode" },
  { keys: ["M"], action: "Mute / Unmute audio" },
  { keys: ["←", "→"], action: "Seek back / forward 10 seconds" },
  { keys: ["↑", "↓"], action: "Increase / decrease volume" },
  { keys: ["0-9"], action: "Jump to 0% - 90% of video timeline" }
];

const More = () => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-black text-white relative">
      <Helmet>
        <title>More | PULSE cinema</title>
      </Helmet>
      <Navigation />

      {/* Background Layer (matching Trending & Features pages) */}
      <div className="fixed inset-0 z-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute inset-0 w-full h-full flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-950 via-slate-950 to-slate-950" />
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-500/30 rounded-full filter blur-[120px] animate-float" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-rose-500/20 rounded-full filter blur-[100px] animate-float-delayed" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent">
          <div className="absolute inset-0 bg-noise opacity-[0.15]" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 pt-36 pb-16 px-4 sm:px-6 md:px-12 max-w-7xl mx-auto">
        
        {/* Page Hero Header */}
        <header className="mb-12 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold mb-4 tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5 animate-spin-slow" />
            <span>PULSE Companion Dashboard</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 font-serif">
            Info, Tips & <span className="gradient-text font-serif">Diagnostics</span>
          </h1>
          <p className="text-gray-400 text-base md:text-lg">
            Maximize your viewing experience with our server diagnostic list, troubleshoot common problems, and master the media shortcuts.
          </p>
        </header>

        {/* Quick Diagnostics Stats Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { label: "Active Servers", value: "6 Online", icon: Server, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
            { label: "Max Resolution", value: "1080P Full HD", icon: MonitorPlay, color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20" },
            { label: "Subscription Cost", value: "$0.00 / Free", icon: Heart, color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20" },
            { label: "Server Load", value: "Normal Speed", icon: Activity, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" }
          ].map((stat, idx) => (
            <div key={idx} className={`glass-card p-5 border rounded-xl flex items-center gap-4 ${stat.bg}`}>
              <div className="p-3 rounded-lg bg-black/40">
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{stat.label}</p>
                <p className="text-lg font-bold text-white mt-0.5">{stat.value}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Two-Column Detail Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Columns (Col Span 2) - Accordion & Keyboard Controls */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Interactive FAQs & Tips Accordion */}
            <section className="glass-card p-6 md:p-8 border border-white/10 rounded-2xl bg-zinc-900/40 backdrop-blur-md">
              <div className="flex items-center gap-3 mb-6">
                <Lightbulb className="w-6 h-6 text-yellow-400" />
                <h2 className="text-2xl font-semibold text-white">Tips & Troubleshooting</h2>
              </div>

              <div className="space-y-4">
                {tipsData.map((tip, index) => {
                  const IconComponent = tip.icon;
                  const isOpen = openFaqIndex === index;

                  return (
                    <div 
                      key={index} 
                      className={`border rounded-xl transition-all duration-300 overflow-hidden ${
                        isOpen 
                          ? "border-violet-500/40 bg-violet-950/10" 
                          : "border-white/5 hover:border-white/10 bg-white/5"
                      }`}
                    >
                      {/* Accordion Trigger Header */}
                      <button 
                        onClick={() => toggleFaq(index)}
                        className="w-full flex items-center justify-between p-5 text-left transition-colors duration-200 hover:text-violet-300"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2.5 rounded-lg ${isOpen ? "bg-violet-500/20 text-violet-300" : "bg-black/30 text-gray-400"}`}>
                            <IconComponent className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base sm:text-lg font-medium text-white">{tip.title}</h3>
                              <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${tip.tagColor}`}>
                                {tip.tag}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div>
                          {isOpen ? (
                            <ChevronUp className="w-5 h-5 text-violet-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </button>

                      {/* Accordion Content Box */}
                      <div 
                        className={`transition-all duration-300 ease-in-out ${
                          isOpen ? "max-h-[300px] border-t border-white/5 opacity-100" : "max-h-0 opacity-0"
                        }`}
                      >
                        <div className="p-5 text-sm sm:text-base text-gray-300 leading-relaxed bg-black/20">
                          {tip.description}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Keyboard Shortcuts Controls Card */}
            <section className="glass-card p-6 md:p-8 border border-white/10 rounded-2xl bg-zinc-900/40 backdrop-blur-md">
              <div className="flex items-center gap-3 mb-6">
                <Keyboard className="w-6 h-6 text-indigo-400" />
                <h2 className="text-2xl font-semibold text-white">Keyboard Controls & Shortcuts</h2>
              </div>
              <p className="text-sm text-gray-400 mb-6">
                Use these hotkeys inside the stream player to navigate your show or movie comfortably without touching your mouse.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {keyboardShortcuts.map((shortcut, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-indigo-500/20 transition-all duration-200">
                    <span className="text-sm text-gray-300 font-medium">{shortcut.action}</span>
                    <div className="flex items-center gap-1.5">
                      {shortcut.keys.map((key, keyIdx) => (
                        <React.Fragment key={keyIdx}>
                          {keyIdx > 0 && <span className="text-xs text-gray-500 font-bold">+</span>}
                          <kbd className="px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-xs text-white font-mono shadow-md font-bold">
                            {key}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

          </div>

          {/* Right Column (Col Span 1) - Server Status & Philosophy */}
          <div className="space-y-8">
            
            {/* Server Status diagnostics */}
            <section className="glass-card p-6 border border-white/10 rounded-2xl bg-zinc-900/40 backdrop-blur-md">
              <div className="flex items-center gap-3 mb-6">
                <Globe className="w-6 h-6 text-purple-400 animate-spin-slow" />
                <h2 className="text-2xl font-semibold text-white font-serif">Server Diagnostics</h2>
              </div>
              <p className="text-xs text-gray-400 mb-6">
                Live capabilities and specs overview of our aggregated streaming nodes.
              </p>

              <div className="space-y-4">
                {servers.map((server, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-black/40 border border-white/5 hover:border-purple-500/20 transition-all duration-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-semibold text-white">{server.name}</h4>
                        <p className="text-xs text-gray-400 mt-0.5">{server.role}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-white/10 text-white rounded">
                          {server.quality}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {server.status}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="px-2 py-0.5 text-[10px] rounded-full bg-zinc-800 text-gray-300 font-medium">
                        Speed: {server.speed}
                      </span>
                      {server.features.map((feat, fIdx) => (
                        <span key={fIdx} className="px-2 py-0.5 text-[10px] rounded-full bg-violet-950/30 text-violet-300 border border-violet-500/10">
                          {feat}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* About / Philosophy Card */}
            <section className="glass-card p-6 border border-white/10 rounded-2xl bg-gradient-to-b from-purple-950/20 to-zinc-950/40 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full filter blur-3xl pointer-events-none" />
              <div className="flex items-center gap-3 mb-4">
                <Info className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-semibold text-white font-serif">About PULSE cinema</h3>
              </div>
              <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
                <p>
                  PULSE cinema is a free, zero-ads streaming indexer designed to bring you your favorite movies and shows without registration walls, tracking cookies, or subscription fees.
                </p>
                <p className="text-xs text-gray-400">
                  Built as a hobby for cinema enthusiasts everywhere. If a server is down, try switching nodes. Sit back, pop some popcorn, and enjoy the show!
                </p>
              </div>
            </section>

          </div>

        </div>

      </div>
    </div>
  );
};

export default More;