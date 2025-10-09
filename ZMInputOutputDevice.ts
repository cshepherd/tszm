interface ZMInputOutputDevice {
  readChar(): Promise<string>;
  readLine(): Promise<string>;
  writeChar(char: string): Promise<void>;
  writeString(str: string): Promise<void>;
  close(): void;

  // Window management (v3+)
  splitWindow?(lines: number): void;
  setWindow?(window: number): void;
  eraseWindow?(window: number): void;
  eraseLine?(value: number): void;

  // Cursor operations (v4+)
  setCursor?(line: number, column: number): void;
  getCursor?(): { line: number; column: number };

  // Text styling (v4+)
  setTextStyle?(style: number): void;

  // Stream control (v3+)
  setBufferMode?(flag: number): void;
  setOutputStream?(number: number, table?: number): void;
  setInputStream?(number: number): void;
}

export { ZMInputOutputDevice };
