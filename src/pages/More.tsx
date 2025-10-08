import React from 'react';
import { Navigation } from '../components/Navigation';
import { Helmet } from 'react-helmet';
import { Info, Lightbulb } from 'lucide-react';

// Tips and tricks data
const tipsAndTricks = [
  {
    title: "Best Server For Movies With Subtitles",
    description: "For the best experience, select VidLink.pro from the server dropdown at the top. Then look for 'RG Shows' under the 720p quality option to get subtitles."
  },
  {
    title: "vidlink.pro Buffering problem",
    description: "Some time vidlink.pro is buffering wht can uh do is switch to some other and come back to vidlink.pro it works"
  },
  { 
    title: "No Media Found Problem In Vidsrc While Clicking On Some Movie Or Show",
    description: "when you click on some movie or show and its [not the latest movie] just press other server to watch Or if series just move forward to another episode and come back inital episode it will be fixed ."
  },
  {
    title: "Search Bar Is Stupid",
    description: "search bar is kinda stupid sometime if it doesnt show the movie you want i am sorry i am working on it mostly it works just my bad coding sorry!"
  },
  {
    title: "Not All Servers Are Working",
    description: "Just my lazy to remove tht part of code hehehe!i will fix it !"
  },
{ 
  title: "Please Install Ads Blocker",
  description: "I use ublock origin and it works great! you can use any other ads blocker but i recommend ublock origin!"
}
];

const More = () => {
  return (
    <div className="min-h-screen bg-black text-white">
      <Helmet>
        <title>More | PULSE cinema</title>
      </Helmet>
      <Navigation />

      {/* Background Layer */}
      <div className="fixed inset-0 z-0 w-full h-full overflow-hidden">
        <div className="absolute inset-0 w-full h-full flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-950 via-slate-950 to-slate-950" />
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-500/30 rounded-full filter blur-[120px] animate-float" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-rose-500/20 rounded-full filter blur-[100px] animate-float-delayed" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent">
          <div className="absolute inset-0 bg-noise opacity-[0.15]" />
        </div>
      </div>

      {/* Content Layer */}
      <div className="relative z-10 pt-24 px-6 md:px-12 max-w-7xl mx-auto">
        {/* About Section */}
        <section className="mb-20">
          <div className="flex items-center gap-3 mb-8">
            <Info className="w-6 h-6 text-purple-400" />
            <h2 className="text-2xl font-semibold">About PULSE cinema</h2>
          </div>
          <div className="glass-card p-8 rounded-xl border border-white/10 flex flex-col items-center text-center">
            <p className="text-lg text-white/80 leading-relaxed mb-2">
              Welcome to PULSE Cinema free streaming for all the brokies out there!
            </p>
            <p className="text-lg text-white/80 leading-relaxed mb-2">
              We made this for you zero-cost, zero-ads, just non-stop movies and shows.
            </p>
            <p className="text-lg text-white/80 leading-relaxed mb-2">
              No fees. No fuss.
            </p>
            <p className="text-lg text-white/80 leading-relaxed">
              Just good vibes and great entertainment.
            </p>
          </div>
        </section>

        {/* Tips & Tricks Section */}
        <section className="mb-20">
          <div className="flex items-center gap-3 mb-12">
            <Lightbulb className="w-6 h-6 text-purple-400" />
            <h2 className="text-2xl font-semibold">Tips & Tricks</h2>
          </div>
          <div className="grid grid-cols-1 gap-6">
            {tipsAndTricks.map((tip, index) => (
              <div 
                key={index} 
                className="glass-card p-8 rounded-xl border border-white/10 transition-all duration-300"
              >
                <div className="flex gap-6">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-purple-400">{(index + 1).toString().padStart(2, '0')}</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-medium text-white">
                        {tip.title}
                      </h3>
                      {index <= 2 && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-yellow-500/20 text-yellow-400 rounded">
                          TIP
                        </span>
                      )}
                      {(index === 3 || index === 4) && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded">
                          BUG
                        </span>
                      )}
                      {index === 5 && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-400 rounded">
                          IMPORTANT
                        </span>
                      )}
                    </div>
                    <p className="text-base text-white/70 leading-relaxed">
                      {tip.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default More; 