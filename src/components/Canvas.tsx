import React, { useRef, useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useStore } from '../store';
import { Point } from '../types';
import { ChevronLeft, ChevronRight, Minus, Plus, Maximize } from 'lucide-react';

import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

interface CanvasProps {
  file: File | null;
}

const Canvas: React.FC<CanvasProps> = ({ file }) => {
  const { 
    measurements, activeTool, activePageIndex, scale, isCalibrating,
    addMeasurement, setScale, setIsCalibrating, setPageIndex,
    zoom, pan, setViewport
  } = useStore();
  
  const [points, setPoints] = useState<Point[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  const [numPages, setNumPages] = useState<number>(0);
  const [isPanning, setIsPanning] = useState(false);
  const [lastMouse, setLastMouse] = useState<{ x: number, y: number } | null>(null);

  // --- Coordinate Transformation ---
  // Converts screen pixel coordinates (e.clientX) to PDF drawing coordinates
  const screenToPdf = (screenX: number, screenY: number) => {
    if (!viewportRef.current) return { x: 0, y: 0 };
    const rect = viewportRef.current.getBoundingClientRect();
    
    // 1. Get coordinates relative to the viewport container
    const viewportX = screenX - rect.left;
    const viewportY = screenY - rect.top;

    // 2. Adjust for Pan and Zoom
    return {
      x: (viewportX - pan.x) / zoom,
      y: (viewportY - pan.y) / zoom
    };
  };

  // --- Mouse Event Handlers ---

  const handleWheel = (e: React.WheelEvent) => {
    // Zoom if Ctrl/Meta key is held, otherwise standard scroll/pan
    if (e.ctrlKey || e.metaKey || e.deltaY) {
      // Allow zooming without modifier for convenience 
      if (e.ctrlKey) {
          e.preventDefault();
          const zoomFactor = -e.deltaY * 0.002;
          const newZoom = Math.min(Math.max(0.2, zoom + zoomFactor), 8); // Limits 0.2x to 8x
          setViewport(newZoom, pan);
      } else {
          // Pan with wheel
          setViewport(zoom, { x: pan.x - e.deltaX, y: pan.y - e.deltaY });
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle Mouse (button 1) OR Left Click + Spacebar = PAN
    if (e.button === 1 || (e.button === 0 && e.getModifierState('Space'))) {
      e.preventDefault();
      setIsPanning(true);
      setLastMouse({ x: e.clientX, y: e.clientY });
      return;
    }

    // Left Click (button 0) = DRAW / INTERACT
    if (e.button === 0) {
      if (activeTool === 'select' && !isCalibrating) return;

      const { x, y } = screenToPdf(e.clientX, e.clientY);
      const newPoints = [...points, { x, y }];
      setPoints(newPoints);

      // Calibration Check
      if (isCalibrating && newPoints.length === 2) {
        finishCalibration(newPoints);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && lastMouse) {
      const dx = e.clientX - lastMouse.x;
      const dy = e.clientY - lastMouse.y;
      setViewport(zoom, { x: pan.x + dx, y: pan.y + dy });
      setLastMouse({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setLastMouse(null);
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isCalibrating) {
      setIsCalibrating(false);
      setPoints([]);
      return;
    }
    if (points.length < 2) return;
    
    addMeasurement(activeTool === 'polygon' ? 'polygon' : 'line', points);
    setPoints([]);
  };

  const finishCalibration = (calPoints: Point[]) => {
    const p1 = calPoints[0];
    const p2 = calPoints[1];
    const pixelDist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    
    const input = prompt("Enter the real-world length of this line (in feet):", "10");
    if (input) {
      const realDist = parseFloat(input);
      if (realDist > 0) {
        const newScale = pixelDist / realDist;
        setScale(newScale);
        alert(`Calibrated! Scale is ${newScale.toFixed(2)} pixels per foot.`);
      }
    }
    
    setPoints([]);
    setIsCalibrating(false);
  };

  // --- Render Helpers ---

  const getCursor = () => {
    if (isPanning) return 'grabbing';
    if (isCalibrating) return 'crosshair';
    if (activeTool !== 'select') return 'crosshair';
    return 'default';
  };

  return (
    <div className="flex-1 relative bg-gray-900 overflow-hidden flex flex-col">
      
      {/* TOOLBAR (Floating) */}
      <div className="absolute top-4 left-4 z-50 flex gap-2">
         <div className="bg-white rounded shadow p-1 flex items-center gap-1">
            <button onClick={() => setViewport(Math.max(0.2, zoom - 0.2), pan)} className="p-2 hover:bg-gray-100 rounded" title="Zoom Out"><Minus size={16}/></button>
            <span className="w-12 text-center text-xs font-mono">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setViewport(Math.min(8, zoom + 0.2), pan)} className="p-2 hover:bg-gray-100 rounded" title="Zoom In"><Plus size={16}/></button>
            <div className="w-[1px] h-6 bg-gray-200 mx-1"></div>
            <button onClick={() => setViewport(1, {x:0, y:0})} className="p-2 hover:bg-gray-100 rounded" title="Reset View"><Maximize size={16}/></button>
         </div>
         {isCalibrating && (
           <div className="bg-yellow-400 text-black px-3 py-2 rounded font-bold text-sm shadow animate-pulse">
             Click 2 points to Calibrate
           </div>
         )}
      </div>

      {/* VIEWPORT (Clipping Container) */}
      <div 
        ref={viewportRef}
        className="flex-1 overflow-hidden cursor-default touch-none"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleRightClick}
        style={{ cursor: getCursor() }}
      >
        {/* WORLD (Transform Container) */}
        <div 
          ref={contentRef}
          className="origin-top-left transition-transform duration-75 ease-out will-change-transform"
          style={{ 
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
          }}
        >
          {file ? (
             <div className="relative inline-block bg-white shadow-2xl">
               <Document 
                 file={file} 
                 onLoadSuccess={({numPages}) => setNumPages(numPages)}
                 loading={<div className="w-[800px] h-[1000px] flex items-center justify-center text-gray-400">Loading...</div>}
               >
                 <Page 
                   pageNumber={activePageIndex + 1} 
                   renderTextLayer={false} 
                   renderAnnotationLayer={false}
                   scale={1.5}
                 />
               </Document>
               
               {/* SVG OVERLAY */}
               <svg className="absolute inset-0 w-full h-full pointer-events-none">
                 {/* Existing Measurements */}
                 {measurements.filter(m => m.pageIndex === activePageIndex).map(m => (
                    <g key={m.id}>
                      {m.type === 'polygon' ? (
                        <polygon 
                          points={m.points.map(p => `${p.x},${p.y}`).join(' ')}
                          fill="rgba(37, 99, 235, 0.3)"
                          stroke="#2563eb"
                          // Scale stroke width inversely so it remains constant visual thickness
                          strokeWidth={2 / zoom} 
                        />
                      ) : (
                        <polyline 
                          points={m.points.map(p => `${p.x},${p.y}`).join(' ')}
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth={3 / zoom} 
                        />
                      )}
                    </g>
                 ))}
                 
                 {/* Active Drawing */}
                 {points.length > 0 && (
                    <>
                      <polyline 
                        points={points.map(p => `${p.x},${p.y}`).join(' ')}
                        fill={activeTool === 'polygon' ? "rgba(0,0,0,0.1)" : "none"}
                        stroke={isCalibrating ? "#facc15" : "#000"}
                        strokeDasharray="5,5"
                        strokeWidth={2 / zoom}
                      />
                      {points.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r={4 / zoom} fill="white" stroke="black" strokeWidth={1/zoom}/>
                      ))}
                    </>
                 )}
               </svg>
             </div>
          ) : (
            <div className="w-[800px] h-[1000px] bg-white flex items-center justify-center text-gray-400 border border-dashed m-20">
               Upload PDF to Start
            </div>
          )}
        </div>
      </div>

      {/* FOOTER NAVIGATION */}
      {file && (
        <div className="h-12 bg-white border-t flex items-center justify-center gap-4 select-none z-50">
           <button 
             disabled={activePageIndex <= 0} 
             onClick={() => setPageIndex(activePageIndex - 1)}
             className="p-2 hover:bg-gray-100 disabled:opacity-30 rounded"
           >
             <ChevronLeft size={20}/>
           </button>
           <span className="font-mono font-medium">Page {activePageIndex + 1} / {numPages || '--'}</span>
           <button 
             disabled={activePageIndex >= numPages - 1} 
             onClick={() => setPageIndex(activePageIndex + 1)}
             className="p-2 hover:bg-gray-100 disabled:opacity-30 rounded"
           >
             <ChevronRight size={20}/>
           </button>
           
           <div className="absolute right-4 text-xs text-gray-400">
             Hold SPACE to Pan • Scroll to Zoom
           </div>
        </div>
      )}
    </div>
  );
};

export default Canvas;