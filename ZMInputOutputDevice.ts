interface ZMInputOutputDevice {
  readChar(): Promise<string>;
  readLine(): Promise<string>;
  writeChar(char: string): Promise<void>;
  writeString(str: string): Promise<void>;
  close(): void;
  // Optional terminal dimensions (for xtermjs and other terminal emulators)
  rows?: number;
  cols?: number;
}

export type { ZMInputOutputDevice };
