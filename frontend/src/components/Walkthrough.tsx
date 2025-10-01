import React, { useState, useEffect } from 'react';

interface WalkthroughStep {
  id: number;
  title: string;
  description: string;
  targetView?: string;
  actionText?: string;
}

const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: 1,
    title: "Welcome to Glyph Foundry",
    description: "Your cinematic knowledge management platform with 4D visualization and ultra-bright neon HDR aesthetics. This quick tour will show you the key features.",
    targetView: "network",
    actionText: "Let's Begin"
  },
  {
    id: 2,
    title: "Knowledge Network",
    description: "Experience your data as a living, breathing 3D neural network. Nodes represent knowledge entities with dynamic sizing based on importance, and edges show relationships with varying strengths.",
    targetView: "network",
    actionText: "See the Network"
  },
  {
    id: 3,
    title: "Data Management",
    description: "Browse, create, and upload data seamlessly. Create custom nodes with properties like color, size, and glow intensity. Upload files and watch them automatically transform into knowledge nodes.",
    targetView: "data",
    actionText: "Manage Data"
  },
  {
    id: 4,
    title: "User Settings",
    description: "Personalize your experience with custom profile settings, AI instructions, and visualization preferences. Control force strength, node labels, and more.",
    targetView: "settings",
    actionText: "View Settings"
  },
  {
    id: 5,
    title: "Overview Dashboard",
    description: "Get insights into your knowledge graph with comprehensive statistics, trends, and analytics. Monitor node growth, relationship patterns, and system health.",
    targetView: "overview",
    actionText: "See Overview"
  },
  {
    id: 6,
    title: "You're All Set!",
    description: "You now know the basics of Glyph Foundry. Start by creating your first node or uploading a file to see the magic happen. Your knowledge graph awaits!",
    actionText: "Start Exploring"
  }
];

interface WalkthroughProps {
  onChangeView?: (view: string) => void;
  onComplete?: () => void;
}

export function Walkthrough({ onChangeView, onComplete }: WalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [hasCompletedBefore, setHasCompletedBefore] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem('glyph-foundry-walkthrough-completed');
    if (completed) {
      setHasCompletedBefore(true);
    } else {
      setTimeout(() => setIsVisible(true), 1000);
    }
  }, []);

  const handleNext = () => {
    const step = WALKTHROUGH_STEPS[currentStep];
    
    if (step.targetView && onChangeView) {
      onChangeView(step.targetView);
    }

    if (currentStep < WALKTHROUGH_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    localStorage.setItem('glyph-foundry-walkthrough-completed', 'true');
    setIsVisible(false);
    if (onComplete) {
      onComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleRestart = () => {
    setCurrentStep(0);
    setIsVisible(true);
  };

  if (!isVisible) {
    return hasCompletedBefore ? (
      <button
        onClick={handleRestart}
        className="fixed bottom-8 right-8 z-40 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-400/50 text-cyan-300 hover:from-cyan-500/30 hover:to-purple-500/30 transition-all backdrop-blur-sm"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium">Show Tutorial</span>
        </div>
      </button>
    ) : null;
  }

  const step = WALKTHROUGH_STEPS[currentStep];
  const progress = ((currentStep + 1) / WALKTHROUGH_STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto" onClick={handleSkip}></div>
      
      <div className="relative max-w-2xl w-full mx-4 pointer-events-auto">
        <div className="bg-gradient-to-br from-black via-cyan-950/30 to-purple-950/30 border-2 border-cyan-400/50 rounded-3xl p-8 shadow-2xl shadow-cyan-500/30 backdrop-blur-xl">
          <div className="mb-6">
            <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-4">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Step {currentStep + 1} of {WALKTHROUGH_STEPS.length}</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
          </div>

          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
                <span className="text-2xl font-black text-white">{step.id}</span>
              </div>
              <h2 className="text-3xl font-black bg-gradient-to-r from-cyan-300 via-purple-300 to-fuchsia-300 bg-clip-text text-transparent">
                {step.title}
              </h2>
            </div>
            <p className="text-gray-300 text-lg leading-relaxed">
              {step.description}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {currentStep < WALKTHROUGH_STEPS.length - 1 && (
              <button
                onClick={handleSkip}
                className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-all font-medium"
              >
                Skip Tour
              </button>
            )}
            
            <button
              onClick={handleNext}
              className="flex-1 px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-bold uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/50"
            >
              <div className="flex items-center justify-center gap-2">
                <span>{step.actionText || "Next"}</span>
                {currentStep < WALKTHROUGH_STEPS.length - 1 && (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                )}
              </div>
            </button>
          </div>

          <div className="mt-6 flex justify-center gap-2">
            {WALKTHROUGH_STEPS.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentStep
                    ? 'bg-cyan-400 w-8'
                    : index < currentStep
                    ? 'bg-purple-500'
                    : 'bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
