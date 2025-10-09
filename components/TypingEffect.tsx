
import React, { useState, useEffect, useMemo } from 'react';

interface TypingEffectProps {
  text: string;
  speed?: number;
  className?: string;
}

const TypingEffect: React.FC<TypingEffectProps> = ({ text, speed = 20, className }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    setDisplayedText('');
    if (text) {
      let i = 0;
      const intervalId = setInterval(() => {
        setDisplayedText(text.substring(0, i + 1));
        i++;
        if (i >= text.length) {
          clearInterval(intervalId);
        }
      }, speed);
      return () => clearInterval(intervalId);
    }
  }, [text, speed]);

  const memoizedHTML = useMemo(() => {
     const html = displayedText
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br />');
    return { __html: html };
  }, [displayedText]);

  return <div className={className} dangerouslySetInnerHTML={memoizedHTML} />;
};

export default TypingEffect;
