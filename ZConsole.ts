import { createInterface, Interface } from "node:readline/promises";
import { ZMInputOutputDevice } from "./ZMInputOutputDevice";

interface Key {
    ctrl: boolean;
    meta: boolean;
    shift: boolean;
    name: string;
};

export class ZConsole implements ZMInputOutputDevice {
    constructor() {
        this.rl = createInterface({
            input: process.stdin,
            historySize: 100,
            prompt: '',
        });
    }

    readChar(): Promise<string> {
        return new Promise<string>(
            (resolve) => {
                process.stdin.once('keypress', ({shift, name}: Key) => {
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
            }
        );
    }

    async readLine(): Promise<string> {
        return new Promise<string>(
            resolve => {
                this.rl.once('line', line => resolve(line))
            }
        );
    }

    async writeChar(char: string): Promise<void> {
        process.stdout.write(char);
    }

    async writeString(str: string): Promise<void> {
        process.stdout.write(str);
    }

    close(): void {
        this.rl.close();
    }

    private rl: Interface;
}
