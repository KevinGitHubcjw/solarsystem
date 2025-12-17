import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import * as MpHands from '@mediapipe/hands';
import type { Results } from '@mediapipe/hands';

interface HandControllerProps {
  onGestureChange: (isFist: boolean) => void;
}

export const HandController: React.FC<HandControllerProps> = ({ onGestureChange }) => {
  const webcamRef = useRef<Webcam>(null);
  const [debugText, setDebugText] = useState('Init AI...');

  useEffect(() => {
    // Dynamically resolve the Hands class to handle different ESM/CJS bundle structures from CDNs
    const HandsClass = (MpHands as any).Hands || (MpHands as any).default?.Hands || (MpHands as any).default;

    if (!HandsClass) {
        console.error("MediaPipe Hands class not found in import:", MpHands);
        setDebugText("AI Load Error");
        return;
    }

    const hands = new HandsClass({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      },
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults(onResults);

    let animationFrameId: number;

    const detect = async () => {
      if (
        webcamRef.current &&
        webcamRef.current.video &&
        webcamRef.current.video.readyState === 4
      ) {
        try {
          await hands.send({ image: webcamRef.current.video });
        } catch (error) {
          console.error("Mediapipe error:", error);
        }
      }
      animationFrameId = requestAnimationFrame(detect);
    };

    detect();

    return () => {
      cancelAnimationFrame(animationFrameId);
      hands.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onResults = (results: Results) => {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      setDebugText('No Hand');
      // If hand is lost, revert to normal orbit
      onGestureChange(false);
      return;
    }

    const landmarks = results.multiHandLandmarks[0];
    
    // Simple Fist Detection Logic
    // Check if fingertips are below the PIP joints (knuckles roughly)
    // 8: Index Tip, 6: Index PIP
    // 12: Middle Tip, 10: Middle PIP
    // 16: Ring Tip, 14: Ring PIP
    // 20: Pinky Tip, 18: Pinky PIP
    
    // Note: In MediaPipe, y increases downwards.
    // So if Tip.y > Pip.y, the finger is bent down (closed).
    
    const isFingerClosed = (tipIdx: number, pipIdx: number) => {
      return landmarks[tipIdx].y > landmarks[pipIdx].y;
    };

    // Thumb is tricky, check x distance relative to wrist or just ignore for simple fist
    // We'll focus on the 4 fingers for stability
    const indexClosed = isFingerClosed(8, 6);
    const middleClosed = isFingerClosed(12, 10);
    const ringClosed = isFingerClosed(16, 14);
    const pinkyClosed = isFingerClosed(20, 18);

    let closedFingers = 0;
    if (indexClosed) closedFingers++;
    if (middleClosed) closedFingers++;
    if (ringClosed) closedFingers++;
    if (pinkyClosed) closedFingers++;

    // Threshold: 3 or more fingers closed = Fist
    const isFist = closedFingers >= 3;

    setDebugText(isFist ? 'FIST DETECTED' : 'OPEN HAND');
    onGestureChange(isFist);
  };

  return (
    <div className="relative w-full h-full bg-black">
      <Webcam
        ref={webcamRef}
        className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
        screenshotFormat="image/jpeg"
        videoConstraints={{
            width: 320,
            height: 240,
            facingMode: "user"
        }}
      />
      <div className="absolute bottom-0 left-0 w-full bg-black/60 p-1 text-center">
        <span className="text-[10px] text-green-400 font-mono tracking-tighter">
            {debugText}
        </span>
      </div>
    </div>
  );
};