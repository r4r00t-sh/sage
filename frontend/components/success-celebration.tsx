'use client';

import { useEffect, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle, Trophy, Star, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SuccessCelebrationProps {
  show: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'success' | 'achievement' | 'milestone';
}

export function SuccessCelebration({
  show,
  onClose,
  title,
  message,
  type = 'success',
}: SuccessCelebrationProps) {
  const [visible, setVisible] = useState(false);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  const triggerConfetti = useCallback((celebrationType: string) => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: ReturnType<typeof setInterval> = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      if (celebrationType === 'achievement') {
        // Gold confetti for achievements
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: ['#FFD700', '#FFA500', '#FF8C00'],
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: ['#FFD700', '#FFA500', '#FF8C00'],
        });
      } else if (celebrationType === 'milestone') {
        // Colorful confetti for milestones
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        });
      } else {
        // Standard green confetti for success
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.3, 0.7), y: Math.random() - 0.2 },
          colors: ['#10b981', '#34d399', '#6ee7b7'],
        });
      }
    }, 250);
  }, []);

  useEffect(() => {
    if (show) {
      const id = requestAnimationFrame(() => setVisible(true));
      triggerConfetti(type);

      // Auto-close after 5 seconds
      const timer = setTimeout(() => {
        handleClose();
      }, 5000);

      return () => {
        cancelAnimationFrame(id);
        clearTimeout(timer);
      };
    }
  }, [show, type, triggerConfetti, handleClose]);

  const getIcon = () => {
    switch (type) {
      case 'achievement':
        return <Trophy className="h-16 w-16 text-amber-500" />;
      case 'milestone':
        return <Star className="h-16 w-16 text-purple-500" />;
      default:
        return <CheckCircle className="h-16 w-16 text-green-500" />;
    }
  };

  if (!show && !visible) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 transition-opacity',
        visible ? 'opacity-100' : 'opacity-0'
      )}
      onClick={handleClose}
    >
      <Card
        className={cn(
          'w-full max-w-md transform transition-all',
          visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <CardContent className="p-8 text-center">
          <div className="mb-6 animate-bounce">
            {getIcon()}
          </div>
          
          <h2 className="text-2xl font-bold mb-3">{title}</h2>
          <p className="text-muted-foreground mb-6">{message}</p>

          {/* Legacy points display removed; celebration is now purely visual */}

          <Button onClick={handleClose} className="w-full">
            Awesome!
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Hook to trigger celebrations
export function useCelebration() {
  const [celebration, setCelebration] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'success' | 'achievement' | 'milestone';
  }>({
    show: false,
    title: '',
    message: '',
    type: 'success',
  });

  const celebrate = (
    title: string,
    message: string,
    type: 'success' | 'achievement' | 'milestone' = 'success',
  ) => {
    setCelebration({ show: true, title, message, type });
  };

  const closeCelebration = () => {
    setCelebration((prev) => ({ ...prev, show: false }));
  };

  return { celebration, celebrate, closeCelebration };
}
