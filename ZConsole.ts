import { createInterface, Interface } from "node:readline/promises";
import { ZMInputOutputDevice } from "./ZMInputOutputDevice";
import { ZMachine } from "./ZMachine";
import * as crypto from "crypto";
import * as http from "http";

interface Key {
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  name: string;
}

export class ZConsole implements ZMInputOutputDevice {
  private ZMCDNText: string = "";
  private zm: ZMachine | null = null;
  private zmcdnEnabled: boolean = false;
  private zmcdnServer: string | undefined = "";
  private currentPrompt: string = "";

  constructor(zmcdnServer: string | undefined) {
    this.zmcdnServer = zmcdnServer;
    if (this.zmcdnServer) {
      this.zmcdnEnabled = true;
    }
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      historySize: 100,
      prompt: "",
    });
  }

  setZMachine(zm: ZMachine): void {
    this.zm = zm;
  }

  async processZMCDNText(): Promise<void> {
    if (this.ZMCDNText && this.zmcdnEnabled) {
      const text = this.ZMCDNText;
      this.ZMCDNText = "";

      // Compute SHA512 hash
      const hash = crypto.createHash("sha512").update(text).digest("hex");

      // Get gameId from header
      if (!this.zm) {
        console.error("ZMachine not initialized");
        return;
      }

      const header = this.zm.getHeader();
      if (!header) {
        console.error("Unable to read game header");
        return;
      }
      const gameId = `${header.release}.${header.serial}`;

      // Make HTTP GET request
      const url = `${this.zmcdnServer}/print/${gameId}/${hash}/sixel`;

      try {
        const data = await this.fetchURL(url);
        console.error(`Received ${data.length} bytes of sixel data`);
        // Dump sixel-formatted graphics to terminal
        process.stdout.write(data);
        process.stdout.write("\n");
      } catch (error) {
        // On failure, POST to generate endpoint
        try {
          await this.postGenerate(gameId, text);
          // If generation succeeds, re-request the image
          const data = await this.fetchURL(url);
          console.error(
            `Received ${data.length} bytes of sixel data after generation`,
          );
          process.stdout.write(data);
          process.stdout.write("\n");
        } catch (postError) {
          console.error(
            `Failed to fetch graphics from ${url}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
    return Promise.resolve();
  }

  private fetchURL(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      http
        .get(url, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            res.resume();
            return;
          }

          let data = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => resolve(data));
        })
        .on("error", reject);
    });
  }

  private postGenerate(gameId: string, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        gameID: gameId,
        text: text,
      });

      const url = new URL(`${this.zmcdnServer}/generate`);
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      };

      const req = http.request(options, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        res.resume();
        resolve();
      });

      req.on("error", reject);
      req.write(postData);
      req.end();
    });
  }

  async readChar(): Promise<string> {
    await this.processZMCDNText();
    return new Promise<string>((resolve) => {
      process.stdin.once("keypress", ({ shift, name }: Key) => {
        if (name.length === 1) {
          if (shift) {
            resolve(name.toUpperCase());
            return;
          }
          resolve(name.toLowerCase());
          return;
        }
        switch (name) {
          default: {
            throw new Error(`Unhandled key "${name}"`);
          }
        }
      });
    });
  }

  async readLine(): Promise<string> {
    await this.processZMCDNText();

    // Set the prompt so readline can preserve it during history navigation
    this.rl.setPrompt(this.currentPrompt);

    return new Promise<string>((resolve) => {
      // Readline needs to be prompted to manage the line properly
      this.rl.prompt();

      this.rl.once("line", (line) => {
        // Check for ZMCDN commands
        const zmcdnMatch = line.trim().match(/^\/zmcdn\s+(.+)$/);
        if (zmcdnMatch) {
          const arg = zmcdnMatch[1];
          if (arg === "off") {
            this.zmcdnEnabled = false;
            console.log("ZMCDN image fetching disabled");
          } else {
            this.zmcdnServer = arg;
            this.zmcdnEnabled = true;
            console.log(`ZMCDN image fetching enabled with server: ${arg}`);
          }
          return this.readLine().then(resolve);
        }
        resolve(line);
      });
    });
  }

  async writeChar(char: string): Promise<void> {
    this.ZMCDNText += char;
    process.stdout.write(char);
    // Track potential prompt characters
    if (char === "\n") {
      this.currentPrompt = "";
    } else {
      this.currentPrompt += char;
      // Keep only last 50 chars as potential prompt
      if (this.currentPrompt.length > 50) {
        this.currentPrompt = this.currentPrompt.slice(-50);
      }
    }
  }

  async writeString(str: string): Promise<void> {
    this.ZMCDNText += str;
    process.stdout.write(str);
    // Track the last line as potential prompt
    const lines = str.split("\n");
    if (lines.length > 1) {
      this.currentPrompt = lines[lines.length - 1];
    } else {
      this.currentPrompt += str;
      // Keep only last 50 chars as potential prompt
      if (this.currentPrompt.length > 50) {
        this.currentPrompt = this.currentPrompt.slice(-50);
      }
    }
  }

  close(): void {
    this.rl.close();
  }

  private rl: Interface;
}
