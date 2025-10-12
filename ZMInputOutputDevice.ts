interface ZMInputOutputDevice {
  readChar(): Promise<string>;
  readLine(): Promise<string>;
  writeChar(char: string): Promise<void>;
  writeString(str: string): Promise<void>;
  close(): void;
}

export type { ZMInputOutputDevice };
