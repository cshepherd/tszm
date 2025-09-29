import { ZMachine } from "./ZMachine";

async function main() {
  const path = "images/ZorkI.z3";
  const zm = new ZMachine(path);
  try {
    await zm.load();
    console.log("Header:", zm.getHeader());
    const mem = await zm.readMemory(0x100, 16);
    console.log("Memory[0x100..]:", mem);

    // write a small sequence (be careful with real game files)
    // await zm.writeMemory(0x100, Buffer.from([0x01, 0x02, 0x03, 0x04]));
  } finally {
    await zm.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
