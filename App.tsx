import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Scissors, 
  Layers, 
  Download, 
  Play, 
  Pause, 
  Image as ImageIcon, 
  Trash2, 
  CheckCircle2, 
  Settings2,
  Pipette,
  Grid,
  RefreshCw,
  X,
  Move,
  Eye,
  ArrowLeft,
  Loader2,
  Maximize,
  Percent
} from 'lucide-react';
import { Frame, ChromaSettings, SheetSettings } from './types';

// --- Utility Functions ---

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 255, 0];
};

// --- Components ---

const StepHeader = ({ step, title, description, active }: { step: number, title: string, description: string, active: boolean }) => (
  <div className={`flex items-start gap-4 p-4 rounded-lg transition-colors ${active ? 'bg-white shadow-sm border border-blue-100' : 'opacity-60 grayscale'}`}>
    <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full font-bold ${active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
      {step}
    </div>
    <div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  </div>
);

export default function App() {
  // State
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Trimming State
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  
  // Extraction State
  const [fps, setFps] = useState(10);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0); // 进度条状态
  const [frames, setFrames] = useState<Frame[]>([]);
  
  // Processing State
  const [chromaSettings, setChromaSettings] = useState<ChromaSettings>({
    enabled: true,
    color: '#00ff00',
    similarity: 0.25,
    smoothness: 0.1,
    spill: 0.1
  });
  
  // Sheet Settings
  const [sheetSettings, setSheetSettings] = useState<SheetSettings>({
    columns: 5,
    scale: 0.5,
    padding: 2,
    outputMode: 'scale',
    customWidth: 128,
    customHeight: 128
  });
  
  // UI State
  const [previewFrameIndex, setPreviewFrameIndex] = useState(0);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [showSheetPreview, setShowSheetPreview] = useState(false);
  const [generatedSheetUrl, setGeneratedSheetUrl] = useState<string | null>(null); // 生成的图片URL
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentFrameDim, setCurrentFrameDim] = useState<{ w: number; h: number } | null>(null); // 当前帧尺寸

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // For extraction
  const previewCanvasRef = useRef<HTMLCanvasElement>(null); // For chroma preview
  const sheetCanvasRef = useRef<HTMLCanvasElement>(null); // For final generation
  
  // Load Video
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoFile(file);
      setVideoSrc(url);
      setFrames([]);
      setStartTime(0);
      setEndTime(0);
      setShowSheetPreview(false);
      setGeneratedSheetUrl(null);
      setProgress(0);
      setCurrentFrameDim(null);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setEndTime(videoRef.current.duration);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      // Auto-loop within trim range
      if (videoRef.current.currentTime >= endTime && isPlaying) {
        videoRef.current.currentTime = startTime;
      }
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  // --- Frame Extraction Logic ---
  const extractFrames = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsExtracting(true);
    setProgress(0);
    setFrames([]);
    setShowSheetPreview(false);
    
    const vid = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!ctx) return;

    // Pause video to control seeking manually
    vid.pause();
    setIsPlaying(false);

    const extracted: Frame[] = [];
    const interval = 1 / fps;
    let cursor = startTime;
    const totalDuration = Math.max(0.1, endTime - startTime); // 防止除以0

    canvas.width = vid.videoWidth;
    canvas.height = vid.videoHeight;

    try {
      while (cursor <= endTime) {
        // Seek
        vid.currentTime = cursor;
        
        // Wait for seek to complete
        await new Promise<void>((resolve) => {
          const onSeek = () => {
            vid.removeEventListener('seeked', onSeek);
            resolve();
          };
          vid.addEventListener('seeked', onSeek, { once: true });
        });

        // Draw
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        
        extracted.push({
          id: crypto.randomUUID(),
          timestamp: cursor,
          originalDataUrl: canvas.toDataURL('image/png'),
          selected: true
        });

        // 更新进度
        const percent = Math.min(100, Math.round(((cursor - startTime) / totalDuration) * 100));
        setProgress(percent);

        cursor += interval;
        // Safety break for extremely long videos
        if (extracted.length > 200) {
            alert("已达上限：为防止内存溢出，本演示仅提取前 200 帧。");
            break;
        }
      }
    } catch (err) {
      console.error("Extraction error", err);
    }

    setFrames(extracted);
    setPreviewFrameIndex(0);
    setProgress(100);
    setTimeout(() => setIsExtracting(false), 500); // 稍微延迟以显示完成状态
    
    // Reset video
    vid.currentTime = startTime;
  };

  // --- Chroma Key Logic ---
  const processFrame = (
    ctx: CanvasRenderingContext2D, 
    img: HTMLImageElement, 
    settings: ChromaSettings,
    width: number,
    height: number
  ) => {
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    if (!settings.enabled) return;

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const [keyR, keyG, keyB] = hexToRgb(settings.color);
    
    const similarityThreshold = settings.similarity * 442; // Max Euclidian roughly
    const smoothRange = settings.smoothness * 100;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const dr = r - keyR;
      const dg = g - keyG;
      const db = b - keyB;
      const dist = Math.sqrt(dr*dr + dg*dg + db*db);

      if (dist < similarityThreshold) {
        // Full transparency
        data[i + 3] = 0;
      } else if (dist < similarityThreshold + smoothRange) {
        // Smooth edge
        const alpha = (dist - similarityThreshold) / smoothRange;
        data[i + 3] = Math.floor(alpha * 255);
      }
    }

    ctx.putImageData(imageData, 0, 0);
  };

  // --- Preview Single Frame Logic ---
  useEffect(() => {
    if (frames.length > 0 && previewCanvasRef.current && frames[previewFrameIndex]) {
      const frame = frames[previewFrameIndex];
      const canvas = previewCanvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        setCurrentFrameDim({ w: img.width, h: img.height });
        processFrame(ctx, img, chromaSettings, img.width, img.height);
      };
      img.src = frame.originalDataUrl;
    }
  }, [frames, previewFrameIndex, chromaSettings]);


  // --- Sprite Sheet Generation ---
  const generateSpriteSheet = async () => {
    if (frames.length === 0 || !sheetCanvasRef.current) {
        console.error("无法生成：帧为空或Canvas未挂载");
        return;
    }
    
    setIsGenerating(true);
    setGeneratedSheetUrl(null);

    const selectedFrames = frames.filter(f => f.selected);
    if (selectedFrames.length === 0) {
      alert("未选择任何帧！");
      setIsGenerating(false);
      return;
    }

    const canvas = sheetCanvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Load first frame to get dimensions
    const loadImg = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    };

    try {
        const firstImg = await loadImg(selectedFrames[0].originalDataUrl);
        const originalW = firstImg.width;
        const originalH = firstImg.height;
        
        // 计算目标宽高
        let targetW: number;
        let targetH: number;

        if (sheetSettings.outputMode === 'fixed') {
            targetW = sheetSettings.customWidth;
            targetH = sheetSettings.customHeight;
        } else {
            targetW = Math.round(originalW * sheetSettings.scale);
            targetH = Math.round(originalH * sheetSettings.scale);
        }

        const cols = sheetSettings.columns;
        const rows = Math.ceil(selectedFrames.length / cols);

        canvas.width = (cols * targetW) + ((cols - 1) * sheetSettings.padding);
        canvas.height = (rows * targetH) + ((rows - 1) * sheetSettings.padding);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Process frames sequentially
        const offCanvas = document.createElement('canvas');
        offCanvas.width = originalW;
        offCanvas.height = originalH;
        const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

        if (!offCtx) throw new Error("Could not create offscreen context");

        for (let i = 0; i < selectedFrames.length; i++) {
            const frame = selectedFrames[i];
            const col = i % cols;
            const row = Math.floor(i / cols);
            
            const x = col * (targetW + sheetSettings.padding);
            const y = row * (targetH + sheetSettings.padding);

            const img = await loadImg(frame.originalDataUrl);
            
            // Process chroma key
            processFrame(offCtx, img, chromaSettings, originalW, originalH);
            
            // Draw to main sheet (with resize)
            ctx.drawImage(offCanvas, 0, 0, originalW, originalH, x, y, targetW, targetH);
        }
        
        const dataUrl = canvas.toDataURL('image/png');
        setGeneratedSheetUrl(dataUrl);
        setShowSheetPreview(true);
        
    } catch (e) {
        console.error("Error generating sheet", e);
        alert("生成精灵图失败。");
    } finally {
        setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedSheetUrl) return;
    const link = document.createElement('a');
    link.download = `spritesheet-${Date.now()}.png`;
    link.href = generatedSheetUrl;
    link.click();
  };

  const handleCanvasClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Pick color
    if (!previewCanvasRef.current) return;
    const rect = previewCanvasRef.current.getBoundingClientRect();
    const scaleX = previewCanvasRef.current.width / rect.width;
    const scaleY = previewCanvasRef.current.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    // We need original image data
    if (frames[previewFrameIndex]) {
        const img = new Image();
        img.src = frames[previewFrameIndex].originalDataUrl;
        await new Promise<void>(r => { img.onload = () => r() });
        const tempC = document.createElement('canvas');
        tempC.width = img.width;
        tempC.height = img.height;
        const tempCtx = tempC.getContext('2d');
        if (tempCtx) {
            tempCtx.drawImage(img, 0, 0);
            const p = tempCtx.getImageData(x, y, 1, 1).data;
            const hex = "#" + ("000000" + ((p[0] << 16) | (p[1] << 8) | p[2]).toString(16)).slice(-6);
            setChromaSettings(s => ({ ...s, color: hex }));
        }
    }
  };

  // --- Drag and Drop Logic ---
  const handleDragStart = (e: React.DragEvent, index: number) => {
      setDraggedIdx(index);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      if (draggedIdx === null) return;
      
      const newFrames = [...frames];
      const [draggedItem] = newFrames.splice(draggedIdx, 1);
      newFrames.splice(dropIndex, 0, draggedItem);
      
      setFrames(newFrames);
      setDraggedIdx(null);
      if (previewFrameIndex === draggedIdx) setPreviewFrameIndex(dropIndex);
  };

  const removeFrame = (id: string) => {
      setFrames(frames.filter(f => f.id !== id));
      if (previewFrameIndex >= frames.length - 1) {
          setPreviewFrameIndex(Math.max(0, frames.length - 2));
      }
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-lg text-white">
              <Layers size={24} />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              SpriteForge
            </h1>
          </div>
          <div className="flex gap-4">
             <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full border border-gray-200">纯前端 • 隐私安全 • 快速</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-12">
        
        {/* Step 1: Upload */}
        <section>
          <StepHeader 
            step={1} 
            title="上传视频" 
            description="选择一个视频文件 (MP4, WebM) 以转换为序列帧。" 
            active={true}
          />
          <div className="mt-6">
            {!videoSrc ? (
              <label className="border-2 border-dashed border-gray-300 rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all group">
                <input type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
                <div className="bg-blue-100 text-blue-600 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
                  <Upload size={32} />
                </div>
                <h3 className="text-lg font-semibold text-gray-700">点击上传或拖拽文件至此</h3>
                <p className="text-gray-400 mt-2 text-sm">支持 MP4, WebM 格式，最大建议 50MB</p>
              </label>
            ) : (
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video shadow-lg max-h-[400px] mx-auto group">
                 <video 
                  ref={videoRef}
                  src={videoSrc}
                  className="w-full h-full object-contain"
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                 />
                 <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => {
                          setVideoSrc(null);
                          setVideoFile(null);
                          setFrames([]);
                          setProgress(0);
                      }} 
                      className="bg-black/50 hover:bg-red-500 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                 </div>
              </div>
            )}
          </div>
        </section>

        {/* Step 2: Trim & Extract */}
        {videoSrc && !showSheetPreview && (
          <section className="animate-fade-in">
            <StepHeader 
              step={2} 
              title="裁剪与提取帧" 
              description="选择视频片段和提取的帧率。" 
              active={true}
            />
            <div className="mt-6 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              
              {/* Controls */}
              <div className="flex flex-wrap items-center gap-6 mb-8">
                <button 
                  onClick={togglePlay}
                  className="flex items-center gap-2 bg-slate-800 text-white px-6 py-2.5 rounded-lg hover:bg-slate-700 transition-colors font-medium"
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                  {isPlaying ? "暂停" : "播放"}
                </button>
                <div className="font-mono text-slate-600 bg-slate-100 px-3 py-1 rounded">
                   {currentTime.toFixed(2)}s / {duration.toFixed(2)}s
                </div>
              </div>

              {/* Timeline / Slider */}
              <div className="relative pt-6 pb-2 px-2 select-none">
                 <div className="absolute top-0 left-0 text-xs font-semibold text-blue-600">开始: {startTime.toFixed(2)}s</div>
                 <div className="absolute top-0 right-0 text-xs font-semibold text-blue-600">结束: {endTime.toFixed(2)}s</div>
                 
                 {/* Range Track */}
                 <div className="h-2 bg-gray-200 rounded-full relative">
                    <div 
                      className="absolute h-full bg-blue-500 rounded-full opacity-30"
                      style={{ 
                        left: `${(startTime / duration) * 100}%`, 
                        width: `${((endTime - startTime) / duration) * 100}%` 
                      }}
                    />
                 </div>
                 
                 {/* Inputs */}
                 <div className="flex gap-4 mt-4">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 block mb-1">开始时间</label>
                      <input 
                        type="range" 
                        min={0} 
                        max={duration} 
                        step={0.1}
                        value={startTime}
                        onChange={(e) => {
                           const val = parseFloat(e.target.value);
                           if (val < endTime) setStartTime(val);
                        }}
                        className="w-full accent-blue-600"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 block mb-1">结束时间</label>
                       <input 
                        type="range" 
                        min={0} 
                        max={duration} 
                        step={0.1}
                        value={endTime}
                        onChange={(e) => {
                           const val = parseFloat(e.target.value);
                           if (val > startTime) setEndTime(val);
                        }}
                        className="w-full accent-blue-600"
                      />
                    </div>
                 </div>
              </div>

              {/* Extraction Settings & Progress */}
              <div className="mt-8 pt-8 border-t border-gray-100">
                
                {/* Progress Bar Display */}
                {(isExtracting || progress > 0) && (
                   <div className="mb-6">
                      <div className="flex justify-between text-xs font-semibold text-gray-600 mb-2">
                         <span>处理进度</span>
                         <span>{progress}%</span>
                      </div>
                      <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                         <div 
                           className="h-full bg-blue-600 transition-all duration-300 ease-out rounded-full"
                           style={{ width: `${progress}%` }}
                         />
                      </div>
                   </div>
                )}

                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">采样率 (FPS)</label>
                    <div className="flex items-center gap-2">
                       {[5, 10, 15, 24, 30].map(f => (
                         <button 
                          key={f}
                          onClick={() => setFps(f)}
                          className={`px-3 py-1.5 text-sm rounded border ${fps === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}
                         >
                           {f} FPS
                         </button>
                       ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      预计帧数: {Math.floor((endTime - startTime) * fps)}
                    </p>
                  </div>

                  <button 
                    onClick={extractFrames}
                    disabled={isExtracting}
                    className={`flex items-center gap-2 px-8 py-3 rounded-lg font-bold text-white shadow-lg shadow-blue-200 transition-all ${isExtracting ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-105 active:scale-95'}`}
                  >
                    {isExtracting ? (
                      <>
                        <Loader2 className="animate-spin" size={20} /> 提取中...
                      </>
                    ) : (
                      <>
                        <Scissors size={20} /> 提取帧
                      </>
                    )}
                  </button>
                </div>
              </div>

              <canvas ref={canvasRef} className="hidden" />
            </div>
          </section>
        )}

        {/* Step 3: Editor & Preview */}
        {frames.length > 0 && !showSheetPreview && (
          <section className="animate-fade-in grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-3">
               <StepHeader 
                step={3} 
                title="编辑与生成" 
                description="去除背景、调整帧顺序并生成最终精灵图。" 
                active={true}
              />
             </div>

             {/* Left Column: Settings */}
             <div className="lg:col-span-1 space-y-6">
                
                {/* Large Preview */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm sticky top-24">
                   <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                     <ImageIcon size={16} /> 预览 (第 {previewFrameIndex + 1} 帧)
                   </h4>
                   <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden checkerboard border border-gray-200">
                      <canvas 
                        ref={previewCanvasRef}
                        onClick={handleCanvasClick}
                        className="w-full h-full object-contain cursor-crosshair"
                      />
                      <div className="absolute bottom-2 left-2 right-2 bg-black/60 text-white text-[10px] p-2 rounded backdrop-blur-sm pointer-events-none text-center">
                         点击图片吸取背景色
                      </div>
                   </div>
                   
                   {/* Chroma Settings */}
                   <div className="mt-6 space-y-5">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                           <Settings2 size={16} /> 绿幕抠图 (Chroma Key)
                        </h4>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={chromaSettings.enabled} onChange={e => setChromaSettings({...chromaSettings, enabled: e.target.checked})} className="sr-only peer" />
                          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      <div className={`space-y-4 transition-opacity ${chromaSettings.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                        <div>
                           <div className="flex gap-2 items-center mb-2">
                              <input 
                                type="color" 
                                value={chromaSettings.color}
                                onChange={(e) => setChromaSettings({...chromaSettings, color: e.target.value})}
                                className="h-8 w-8 rounded cursor-pointer border-0 p-0"
                              />
                              <span className="text-xs font-mono text-gray-500 uppercase">{chromaSettings.color}</span>
                           </div>
                        </div>
                        <div>
                           <label className="text-xs font-semibold text-gray-500 mb-1 block">相似度 (Similarity)</label>
                           <input type="range" min="0" max="1" step="0.01" value={chromaSettings.similarity} onChange={(e) => setChromaSettings({...chromaSettings, similarity: parseFloat(e.target.value)})} className="w-full accent-blue-600" />
                        </div>
                        <div>
                           <label className="text-xs font-semibold text-gray-500 mb-1 block">平滑度 (Smoothness)</label>
                           <input type="range" min="0" max="1" step="0.01" value={chromaSettings.smoothness} onChange={(e) => setChromaSettings({...chromaSettings, smoothness: parseFloat(e.target.value)})} className="w-full accent-blue-600" />
                        </div>
                      </div>

                      <div className="pt-4 border-t border-gray-100">
                        <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm">
                           <Grid size={16} /> 布局与尺寸
                        </h4>
                        
                        <div className="space-y-4">
                            {/* Mode Toggle */}
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button 
                                    className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${sheetSettings.outputMode === 'scale' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                                    onClick={() => setSheetSettings({...sheetSettings, outputMode: 'scale'})}
                                >
                                    <span className="flex items-center justify-center gap-1"><Percent size={12}/> 按比例</span>
                                </button>
                                <button 
                                    className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${sheetSettings.outputMode === 'fixed' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                                    onClick={() => setSheetSettings({...sheetSettings, outputMode: 'fixed'})}
                                >
                                    <span className="flex items-center justify-center gap-1"><Maximize size={12}/> 固定尺寸</span>
                                </button>
                            </div>

                            {sheetSettings.outputMode === 'scale' ? (
                                <div>
                                    <div className="flex justify-between items-start mb-1">
                                      <label className="text-xs font-semibold text-gray-500 block">输出比例 ({(sheetSettings.scale * 100).toFixed(0)}%)</label>
                                      {currentFrameDim && (
                                         <div className="text-[10px] text-right leading-tight">
                                           <span className="text-gray-400 block">原始: {currentFrameDim.w} x {currentFrameDim.h}</span>
                                           <span className="text-blue-600 font-bold block">结果: {Math.round(currentFrameDim.w * sheetSettings.scale)} x {Math.round(currentFrameDim.h * sheetSettings.scale)}</span>
                                         </div>
                                      )}
                                    </div>
                                    <input type="range" min="0.1" max="1" step="0.05" value={sheetSettings.scale} onChange={(e) => setSheetSettings({...sheetSettings, scale: parseFloat(e.target.value)})} className="w-full accent-blue-600" />
                                </div>
                            ) : (
                                <div className="space-y-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1">
                                            <label className="text-[10px] uppercase text-gray-400 font-bold mb-1 block">宽 (px)</label>
                                            <input 
                                                type="number" 
                                                value={sheetSettings.customWidth} 
                                                onChange={(e) => setSheetSettings({...sheetSettings, customWidth: parseInt(e.target.value) || 0})}
                                                className="w-full p-1.5 border border-gray-200 rounded text-sm text-center" 
                                            />
                                        </div>
                                        <span className="text-gray-300 mt-4">×</span>
                                        <div className="flex-1">
                                            <label className="text-[10px] uppercase text-gray-400 font-bold mb-1 block">高 (px)</label>
                                            <input 
                                                type="number" 
                                                value={sheetSettings.customHeight} 
                                                onChange={(e) => setSheetSettings({...sheetSettings, customHeight: parseInt(e.target.value) || 0})}
                                                className="w-full p-1.5 border border-gray-200 rounded text-sm text-center" 
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase text-gray-400 font-bold mb-2 block">推荐尺寸</label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {[64, 128, 256, 512].map(size => (
                                                <button 
                                                    key={size}
                                                    onClick={() => setSheetSettings({...sheetSettings, customWidth: size, customHeight: size})}
                                                    className={`text-xs py-1 border rounded transition-colors ${sheetSettings.customWidth === size && sheetSettings.customHeight === size ? 'bg-blue-100 text-blue-700 border-blue-200 font-bold' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                                                >
                                                    {size}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 mb-1 block">列数</label>
                                    <input type="number" min="1" max="50" value={sheetSettings.columns} onChange={(e) => setSheetSettings({...sheetSettings, columns: Math.max(1, parseInt(e.target.value))})} className="w-full p-2 border border-gray-200 rounded text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 mb-1 block">间距 (px)</label>
                                    <input type="number" min="0" max="100" value={sheetSettings.padding} onChange={(e) => setSheetSettings({...sheetSettings, padding: Math.max(0, parseInt(e.target.value))})} className="w-full p-2 border border-gray-200 rounded text-sm" />
                                </div>
                            </div>
                        </div>
                      </div>

                      <button 
                        onClick={generateSpriteSheet}
                        disabled={isGenerating}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                      >
                         {isGenerating ? <Loader2 className="animate-spin" /> : <Eye size={20} />}
                         生成精灵图预览
                      </button>
                   </div>
                </div>
             </div>

             {/* Right Column: Frame List */}
             <div className="lg:col-span-2">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-auto min-h-[600px]">
                   <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                         <span className="font-bold text-gray-800">帧序列</span>
                         <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{frames.filter(f => f.selected).length} 帧已选</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setFrames(frames.map(f => ({...f, selected: true})))} className="text-xs text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded font-medium">全选</button>
                        <button onClick={() => setFrames(frames.map(f => ({...f, selected: false})))} className="text-xs text-gray-500 hover:bg-gray-100 px-3 py-1.5 rounded font-medium">取消全选</button>
                      </div>
                   </div>
                   
                   <div className="p-4 bg-gray-50 flex-1">
                     <p className="text-xs text-gray-400 mb-4 flex items-center gap-1">
                        <Move size={12} /> 拖拽可调整顺序 • 点击 X 移除
                     </p>
                     <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {frames.map((frame, idx) => (
                           <div 
                              key={frame.id} 
                              draggable
                              onDragStart={(e) => handleDragStart(e, idx)}
                              onDragOver={(e) => handleDragOver(e, idx)}
                              onDrop={(e) => handleDrop(e, idx)}
                              className={`relative group bg-white rounded-lg border-2 cursor-pointer transition-all overflow-hidden hover:scale-[1.02] ${frame.selected ? 'border-blue-500 shadow-md' : 'border-transparent opacity-60 grayscale'} ${draggedIdx === idx ? 'opacity-20 border-dashed border-gray-400' : ''}`}
                              onClick={() => {
                                 const newFrames = [...frames];
                                 newFrames[idx].selected = !newFrames[idx].selected;
                                 setFrames(newFrames);
                              }}
                           >
                              {/* Overlay Controls */}
                              <div className="absolute top-1 right-1 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      removeFrame(frame.id);
                                  }}
                                  className="bg-red-500 text-white p-1 rounded hover:bg-red-600"
                                  title="删除帧"
                                >
                                  <X size={10} />
                                </button>
                              </div>

                              <div className="absolute top-1 left-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                 <span className="bg-black/50 text-white text-[10px] px-1 rounded"><Move size={10} /></span>
                              </div>

                              {/* Selection Indicator */}
                              <div className={`absolute bottom-1 right-1 z-10 w-4 h-4 rounded-full flex items-center justify-center ${frame.selected ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                                 {frame.selected && <CheckCircle2 size={10} />}
                              </div>

                              {/* Number Badge */}
                              <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-1.5 rounded">
                                 {idx + 1}
                              </div>
                              
                              <div className="aspect-square w-full checkerboard relative">
                                <img src={frame.originalDataUrl} className="w-full h-full object-contain" alt="" />
                                {/* Preview Click Area */}
                                <div 
                                  className="absolute inset-0 z-10"
                                  onClick={(e) => {
                                     e.stopPropagation();
                                     setPreviewFrameIndex(idx);
                                  }} 
                                  title="点击预览此帧"
                                />
                              </div>
                           </div>
                        ))}
                     </div>
                   </div>
                </div>
             </div>
          </section>
        )}

        {/* Sheet Preview Modal/Overlay */}
        {showSheetPreview && (
            <div className="fixed inset-0 z-[100] bg-gray-900/90 backdrop-blur-sm flex flex-col overflow-hidden animate-fade-in">
                <div className="bg-white border-b px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setShowSheetPreview(false)}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">精灵图预览 (Sprite Sheet)</h2>
                            <p className="text-sm text-gray-500">
                                {sheetCanvasRef.current?.width}x{sheetCanvasRef.current?.height}px
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <button 
                            onClick={() => setShowSheetPreview(false)}
                            className="px-6 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg"
                        >
                            继续编辑
                        </button>
                        <button 
                            onClick={handleDownload}
                            className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg flex items-center gap-2"
                        >
                            <Download size={20} /> 下载 PNG
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-auto p-8 flex items-center justify-center bg-gray-50/50">
                    <div className="bg-white p-2 shadow-2xl rounded-lg border border-gray-200 checkerboard max-w-full max-h-full overflow-auto">
                        {/* 使用生成的图片URL显示，而不是直接移动Canvas */}
                        {generatedSheetUrl ? (
                            <img src={generatedSheetUrl} alt="Sprite Sheet" className="max-w-none shadow-sm" />
                        ) : (
                            <div className="p-10 text-gray-500">加载中...</div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* 关键修复：将用于生成的Canvas始终保留在DOM中（隐藏），确保ref始终有效 */}
        <canvas ref={sheetCanvasRef} className="hidden" />

      </main>
    </div>
  );
}