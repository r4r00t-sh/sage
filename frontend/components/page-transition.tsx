'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [isVisible, setIsVisible] = useState(true);
  const prevPathnameRef = useRef<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only animate if pathname actually changed
    if (prevPathnameRef.current !== null && prevPathnameRef.current !== pathname) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Step 1: Fade out current content
      setIsVisible(false);

      // Step 2: After fade out (200ms), update content
      timeoutRef.current = setTimeout(() => {
        setDisplayChildren(children);
        
        // Step 3: Wait for DOM update, then fade in
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsVisible(true);
          });
        });
      }, 200);

      prevPathnameRef.current = pathname;
    } else {
      // First render or same pathname - no transition needed
      setDisplayChildren(children);
      setIsVisible(true);
      if (prevPathnameRef.current === null) {
        prevPathnameRef.current = pathname;
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [pathname, children]);

  return (
    <div
      className={cn(
        'page-transition-wrapper',
        isVisible ? 'page-transition-visible' : 'page-transition-hidden'
      )}
      data-page-transition
    >
      {displayChildren}
    </div>
  );
}

