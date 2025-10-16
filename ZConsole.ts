import { createInterface, Interface } from "node:readline/promises";
import { ZMInputOutputDevice } from "./ZMInputOutputDevice";
import { ZMCDNInput } from "./ZMCDNInput";
import { ZMachine } from "./ZMachine";
import * as crypto from "crypto";
import * as http from "http";
import * as https from "https";

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
  private zmcdnServer: string | undefined;
  private currentPrompt: string = "";
  private zmcdnSessionId: string = "";
  private lastzmcdnInput: ZMCDNInput | null = null;
  private inCursorSaveBlock: boolean = false;

  // set our protocol for future https update
  private static getHttpModule(url: URL) {
    return url.protocol === "https:" ? https : http;
  }

  private static normalizeZmcdnUrl(raw?: string): string | undefined {
    if (!raw) return undefined;
    let s = raw.trim();
    if (!s) return undefined;

    // fix common "missing colon" typos: https//host or http//host
    //    e.g., "https//foo" -> "https://foo"
    s = s.replace(/^(https?)(\/\/)(?!\/)/i, (_m, proto: string) => `${proto}://`);

    // reject non http/https protocols
    if (/^[a-z][a-z0-9+\-.]*:\/\//i.test(s) && !/^https?:\/\//i.test(s)) {
      return undefined;
    }

    // catch some typical typos
    if (/^\/\//.test(s)) {
      s = `http:${s}`;
    }

    // default to http
    if (!/^https?:\/\//i.test(s)) {
      s = `http://${s}`;
    }

    // 5) Parse and normalize
    try {
      const u = new URL(s);

      // Guard against double-scheme accidents like "http://https//host"
      if (/^https?:$/.test(u.protocol) && /^https?\/\//i.test(u.hostname)) {
        return undefined;
      }

      u.hash = ""; // drop fragments
      return u.toString().replace(/\/+$/, ""); // strip trailing slash(es)
    } catch {
      return undefined;
    }
  }

  constructor(zmcdnServer: string | undefined) {
    const normalized = ZConsole.normalizeZmcdnUrl(zmcdnServer);

    if (normalized) {
      this.zmcdnServer = normalized;
      this.zmcdnEnabled = true;
    } else if (typeof zmcdnServer === "string" && zmcdnServer.trim() !== "") {
      // warn only if value is provided and malformed
      console.warn(`Ignoring invalid --zmcdn value: ${String(zmcdnServer)}`);
      this.zmcdnEnabled = false;
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
      if (!this.zmcdnSessionId) {
        this.zmcdnSessionId = crypto.randomUUID();
      }
      const zmcdnInput = new ZMCDNInput();
      zmcdnInput.zmcdnSessionID = this.zmcdnSessionId;
      zmcdnInput.lastZMachineOutput = this.ZMCDNText;
      this.ZMCDNText = '';

      // Get gameId from header
      if (!this.zm) {
        console.error("ZMachine not initialized");
        return;
      }

      zmcdnInput.lastZMachineInput = this.zm.getLastRead();

      const header = this.zm.getHeader();
      if (!header) {
        console.error("Unable to read game header");
        return;
      }

      zmcdnInput.gameIdentifier = `${header.release}.${header.serial}`;

      const playerParent = this.zm.findPlayerParent();
      if(playerParent) {
        zmcdnInput.playerLocation = playerParent.name;
      } else {
        zmcdnInput.playerLocation = '';
      }

      zmcdnInput.illustrationFormat = 'sixel';
      this.lastzmcdnInput = zmcdnInput;

      const url = `${this.zmcdnServer}/illustrateMove`;
      try {
        const data = await this.postJSON(url, zmcdnInput);
        // Dump sixel-formatted graphics to terminal
        process.stdout.write(data);
        process.stdout.write("\n");
        process.stdout.write(zmcdnInput.lastZMachineOutput);
      } catch (error) {
        console.error(
          `Failed to fetch graphics from ${url}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return Promise.resolve();
  }

  private postJSON(urlStr: string, data: unknown): Promise<string> {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(data);
      const urlObj = new URL(urlStr); // assume caller passed normalized base + path
      const client = ZConsole.getHttpModule(urlObj);

      const options: http.RequestOptions = {
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === "https:" ? 443 : 80),
        path: `${urlObj.pathname}${urlObj.search}`, // keep any ?query=params
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
        // If URL includes user:pass, pass it through for basic auth:
        auth: urlObj.username
          ? `${decodeURIComponent(urlObj.username)}:${decodeURIComponent(urlObj.password)}`
          : undefined,
      };

      const req = client.request(options, (res) => {
        let responseData = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          responseData += chunk;
        });
        res.on("end", () => {
          if (res.statusCode !== 200) {
            console.error(`HTTP ${res.statusCode} error response:`, responseData);
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
            return;
          }
          resolve(responseData);
        });
      });

      req.on("error", reject);
      req.write(postData);
      req.end();
    });
  }

  private fetchURL(urlStr: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(urlStr);
      const client = ZConsole.getHttpModule(urlObj); // http or https based on protocol

      const req = client.get(urlObj, (res) => {
        const status = res.statusCode ?? 0;
        if (status !== 200) {
          res.resume(); // drain to free socket
          reject(new Error(`HTTP ${status}`));
          return;
        }

        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => resolve(data));
      });

      req.on("error", reject);
    });
  }

  private postGenerate(gameId: string, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.zmcdnServer) {
        return reject(new Error("ZMCDN not configured"));
      }

      const postData = JSON.stringify({ gameID: gameId, text });
      const urlObj = new URL(`${this.zmcdnServer}/generate`);
      const client = ZConsole.getHttpModule(urlObj);

      const options: http.RequestOptions = {
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === "https:" ? 443 : 80),
        path: `${urlObj.pathname}${urlObj.search}`, // keep any ?query=params
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
        auth: urlObj.username
          ? `${decodeURIComponent(urlObj.username)}:${decodeURIComponent(urlObj.password)}`
          : undefined,
      };

      const req = client.request(options, (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 400) {
          res.resume(); // drain to free socket
          reject(new Error(`HTTP ${status}`));
          return;
        }
        // fully drain before resolving
        res.on("data", () => {});
        res.on("end", () => resolve());
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
        // Handle undefined name
        if (!name) {
          resolve("\r"); // Return carriage return for undefined keys
          return;
        }

        if (name.length === 1) {
          if (shift) {
            resolve(name.toUpperCase());
            return;
          }
          resolve(name.toLowerCase());
          return;
        }

        // Handle special keys
        switch (name) {
          case "return":
            resolve("\r"); // ZSCII 13 (carriage return)
            return;
          case "escape":
            resolve("\x1b"); // ZSCII 27 (escape)
            return;
          case "delete":
          case "backspace":
            resolve("\b"); // ZSCII 8 (backspace)
            return;
          case "up":
            resolve("\x81"); // ZSCII 129 (cursor up)
            return;
          case "down":
            resolve("\x82"); // ZSCII 130 (cursor down)
            return;
          case "left":
            resolve("\x83"); // ZSCII 131 (cursor left)
            return;
          case "right":
            resolve("\x84"); // ZSCII 132 (cursor right)
            return;
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
        // Check for trace commands
        const traceMatch = line.trim().match(/^\/trace\s+(on|off)$/);
        if (traceMatch) {
          const arg = traceMatch[1];
          if (this.zm) {
            if (arg === "on") {
              this.zm.setTrace(true);
              console.log("Trace enabled");
            } else {
              this.zm.setTrace(false);
              console.log("Trace disabled");
            }
          } else {
            console.log("ZMachine not initialized");
          }
          return this.readLine().then(resolve);
        }

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

        // Check for redraw command
        if (line.trim() === "/redraw") {
          if (!this.lastzmcdnInput) {
            console.log("No previous ZMCDN input to redraw");
          } else if (!this.zmcdnEnabled) {
            console.log("ZMCDN is disabled");
          } else {
            const redrawInput = { ...this.lastzmcdnInput, invalidate: true };
            const url = `${this.zmcdnServer}/illustrateMove`;
            this.postJSON(url, redrawInput)
              .then((data) => {
                process.stdout.write(data);
                process.stdout.write("\n");
                process.stdout.write(redrawInput.lastZMachineOutput);
              })
              .catch((error) => {
                console.error(
                  `Failed to fetch graphics from ${url}: ${error instanceof Error ? error.message : String(error)}`,
                );
              });
          }
          return this.readLine().then(resolve);
        }
        resolve(line);
      });
    });
  }

  async writeChar(char: string): Promise<void> {
    if(this.zmcdnEnabled) {
      this.ZMCDNText += char;
    } else {
      process.stdout.write(char);
    }
    // Track potential prompt characters, but ignore content between cursor save/restore
    // ESC 7 = save cursor, ESC 8 = restore cursor
    if (char === "\x1b7") {
      this.inCursorSaveBlock = true;
    } else if (char === "\x1b8") {
      this.inCursorSaveBlock = false;
      // Don't clear currentPrompt here - content after restore is the actual prompt
    } else if (!this.inCursorSaveBlock) {
      // Only track prompt when not in a cursor save block
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
  }

  async writeString(str: string): Promise<void> {
    // If string contains VT100 escape sequences, write immediately instead of buffering
    const hasVT100 = str.includes('\x1b');

    if(this.zmcdnEnabled && !hasVT100) {
      this.ZMCDNText += str;
    } else {
      process.stdout.write(str);
    }

    // Track the last line as potential prompt, but ignore content between cursor save/restore
    // Process each character to handle escape sequences properly
    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      // Check for cursor save (ESC 7) - need to check if next char is '7'
      if (char === "\x1b" && i + 1 < str.length && str[i + 1] === "7") {
        this.inCursorSaveBlock = true;
        i++; // Skip the '7'
        continue;
      }

      // Check for cursor restore (ESC 8) - need to check if next char is '8'
      if (char === "\x1b" && i + 1 < str.length && str[i + 1] === "8") {
        this.inCursorSaveBlock = false;
        i++; // Skip the '8'
        continue;
      }

      // Only track prompt when not in a cursor save block
      if (!this.inCursorSaveBlock) {
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
    }
  }

  close(): void {
    this.rl.close();
  }

  get isZmcdnEnabled() { return this.zmcdnEnabled; }
  get zmcdnServerUrl() { return this.zmcdnServer; }

  private rl: Interface;
}
