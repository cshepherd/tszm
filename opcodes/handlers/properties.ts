// Property manipulation handlers

export function h_get_prop_len(vm: any, [propDataAddr]: number[], ctx: { store?: (v: number) => void }) {
  if (!vm.memory || !vm.header) {
    console.error("Memory or header not loaded");
    return;
  }

  if (propDataAddr === 0) {
    ctx.store?.(0);
    return;
  }

  const sizeByte = vm.memory.readUInt8(propDataAddr - 1);

  let propLen: number;
  if (vm.header.version <= 3) {
    propLen = (sizeByte >> 5) + 1;
  } else {
    if (sizeByte & 0x80) {
      const secondByte = vm.memory.readUInt8(propDataAddr - 2);
      propLen = secondByte & 0x3f;
      if (propLen === 0) propLen = 64;
    } else {
      propLen = sizeByte & 0x40 ? 2 : 1;
    }
  }

  ctx.store?.(propLen);
}

export function h_get_prop(vm: any, [objectId, propNum]: number[], ctx: { store?: (v: number) => void }) {
  if (!vm.memory || !vm.header) {
    console.error("Memory or header not loaded");
    return;
  }

  const objectAddress = vm.getObjectAddress(objectId);
  const objectEntrySize = vm.header.version <= 3 ? 9 : 14;
  const propertyTableAddr = vm.memory.readUInt16BE(objectAddress + objectEntrySize - 2);

  const nameLength = vm.memory.readUInt8(propertyTableAddr);
  let propAddr = propertyTableAddr + 1 + nameLength * 2;

  let propValue = 0;
  let found = false;

  while (true) {
    const sizeByte = vm.memory.readUInt8(propAddr);
    if (sizeByte === 0) break;

    let currentNum: number;
    let dataSize: number;

    if (vm.header.version <= 3) {
      dataSize = (sizeByte >> 5) + 1;
      currentNum = sizeByte & 0x1f;
      propAddr += 1;
    } else {
      currentNum = sizeByte & 0x3f;
      if (sizeByte & 0x80) {
        const secondByte = vm.memory.readUInt8(propAddr + 1);
        dataSize = secondByte & 0x3f;
        if (dataSize === 0) dataSize = 64;
        propAddr += 2;
      } else {
        dataSize = sizeByte & 0x40 ? 2 : 1;
        propAddr += 1;
      }
    }

    if (currentNum === propNum) {
      if (dataSize === 1) {
        propValue = vm.memory.readUInt8(propAddr);
      } else if (dataSize === 2) {
        propValue = vm.memory.readUInt16BE(propAddr);
      } else {
        console.error(`Invalid property size ${dataSize} for get_prop`);
        return;
      }
      found = true;
      break;
    }

    propAddr += dataSize;
  }

  if (!found) {
    const defaultAddr = vm.header.objectTableAddress + (propNum - 1) * 2;
    propValue = vm.memory.readUInt16BE(defaultAddr);
  }

  ctx.store?.(propValue);
}

export function h_get_prop_addr(vm: any, [objectId, propNum]: number[], ctx: { store?: (v: number) => void }) {
  if (!vm.memory || !vm.header) {
    console.error("Memory or header not loaded");
    return;
  }

  const objectAddress = vm.getObjectAddress(objectId);
  const objectEntrySize = vm.header.version <= 3 ? 9 : 14;
  const propertyTableAddr = vm.memory.readUInt16BE(objectAddress + objectEntrySize - 2);

  const nameLength = vm.memory.readUInt8(propertyTableAddr);
  let propAddr = propertyTableAddr + 1 + nameLength * 2;

  let result = 0;

  while (true) {
    const sizeByte = vm.memory.readUInt8(propAddr);
    if (sizeByte === 0) break;

    let currentNum: number;
    let dataSize: number;
    let dataAddr: number;

    if (vm.header.version <= 3) {
      dataSize = (sizeByte >> 5) + 1;
      currentNum = sizeByte & 0x1f;
      dataAddr = propAddr + 1;
    } else {
      currentNum = sizeByte & 0x3f;
      if (sizeByte & 0x80) {
        const secondByte = vm.memory.readUInt8(propAddr + 1);
        dataSize = secondByte & 0x3f;
        if (dataSize === 0) dataSize = 64;
        dataAddr = propAddr + 2;
      } else {
        dataSize = sizeByte & 0x40 ? 2 : 1;
        dataAddr = propAddr + 1;
      }
    }

    if (currentNum === propNum) {
      result = dataAddr;
      break;
    }

    propAddr = dataAddr + dataSize;
  }

  ctx.store?.(result);
}

export function h_put_prop(vm: any, [objectId, propNum, value]: number[]) {
  if (!vm.memory || !vm.header) {
    console.error("Memory or header not loaded");
    return;
  }

  const objectAddress = vm.getObjectAddress(objectId);
  const objectEntrySize = vm.header.version <= 3 ? 9 : 14;
  const propertyTableAddr = vm.memory.readUInt16BE(objectAddress + objectEntrySize - 2);

  const nameLength = vm.memory.readUInt8(propertyTableAddr);
  let propAddr = propertyTableAddr + 1 + nameLength * 2;

  while (true) {
    const sizeByte = vm.memory.readUInt8(propAddr);
    if (sizeByte === 0) {
      console.error(`Property ${propNum} not found on object ${objectId}`);
      return;
    }

    let currentNum: number;
    let dataSize: number;
    let dataAddr: number;

    if (vm.header.version <= 3) {
      dataSize = (sizeByte >> 5) + 1;
      currentNum = sizeByte & 0x1f;
      dataAddr = propAddr + 1;
    } else {
      currentNum = sizeByte & 0x3f;
      if (sizeByte & 0x80) {
        const secondByte = vm.memory.readUInt8(propAddr + 1);
        dataSize = secondByte & 0x3f;
        if (dataSize === 0) dataSize = 64;
        dataAddr = propAddr + 2;
      } else {
        dataSize = sizeByte & 0x40 ? 2 : 1;
        dataAddr = propAddr + 1;
      }
    }

    if (currentNum === propNum) {
      if (dataSize === 1) {
        vm.memory.writeUInt8(value & 0xff, dataAddr);
      } else if (dataSize === 2) {
        vm.memory.writeUInt16BE(value, dataAddr);
      } else {
        console.error(`Invalid property size ${dataSize} for put_prop`);
        return;
      }
      return;
    }

    propAddr = dataAddr + dataSize;
  }
}
