export interface Frame {
  id: string;
  timestamp: number;
  originalDataUrl: string; // The raw captured frame
  selected: boolean;
}

export interface ChromaSettings {
  enabled: boolean;
  color: string; // Hex
  similarity: number; // 0-1
  smoothness: number; // 0-1
  spill: number; // 0-1
}

export interface SheetSettings {
  columns: number;
  scale: number; // 0.1 - 1.0
  padding: number;
  outputMode: 'scale' | 'fixed';
  customWidth: number;
  customHeight: number;
}