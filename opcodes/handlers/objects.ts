// Object tree manipulation handlers

export function h_get_sibling(
  vm: any,
  [objectId]: number[],
  ctx: { store?: (v: number) => void; branch?: (c: boolean) => void },
) {
  if (!vm.memory || !vm.header) {
    console.error("Memory or header not loaded");
    return;
  }

  const objectAddress = vm.getObjectAddress(objectId);

  let siblingValue: number;
  if (vm.header.version <= 3) {
    siblingValue = vm.memory.readUInt8(objectAddress + 5);
  } else {
    siblingValue = vm.memory.readUInt16BE(objectAddress + 9);
  }

  ctx.store?.(siblingValue);
  ctx.branch?.(siblingValue !== 0);
}

export function h_get_child(
  vm: any,
  [objectId]: number[],
  ctx: { store?: (v: number) => void; branch?: (c: boolean) => void },
) {
  if (!vm.memory || !vm.header) {
    console.error("Memory or header not loaded");
    return;
  }

  const objectAddress = vm.getObjectAddress(objectId);

  let childValue: number;
  if (vm.header.version <= 3) {
    childValue = vm.memory.readUInt8(objectAddress + 6);
  } else {
    childValue = vm.memory.readUInt16BE(objectAddress + 10);
  }

  ctx.store?.(childValue);
  ctx.branch?.(childValue !== 0);
}

export function h_get_parent(
  vm: any,
  [objectId]: number[],
  ctx: { store?: (v: number) => void },
) {
  if (!vm.memory || !vm.header) {
    console.error("Memory or header not loaded");
    return;
  }

  const objectAddress = vm.getObjectAddress(objectId);

  let parentValue: number;
  if (vm.header.version <= 3) {
    parentValue = vm.memory.readUInt8(objectAddress + 4);
  } else {
    parentValue = vm.memory.readUInt16BE(objectAddress + 6);
  }

  ctx.store?.(parentValue);
}

export function h_remove_obj(vm: any, [objectId]: number[]) {
  if (!vm.memory || !vm.header) {
    console.error("Memory or header not loaded");
    return;
  }

  if (objectId === 0) {
    return;
  }

  const objAddress = vm.getObjectAddress(objectId);

  // Read the object's parent
  let parentId: number;
  if (vm.header.version <= 3) {
    parentId = vm.memory.readUInt8(objAddress + 4);
  } else {
    parentId = vm.memory.readUInt16BE(objAddress + 6);
  }

  if (parentId === 0) {
    return;
  }

  const parentAddress = vm.getObjectAddress(parentId);

  // Read parent's child
  let parentChildId: number;
  if (vm.header.version <= 3) {
    parentChildId = vm.memory.readUInt8(parentAddress + 6);
  } else {
    parentChildId = vm.memory.readUInt16BE(parentAddress + 10);
  }

  // If the object being removed is the parent's first child
  if (parentChildId === objectId) {
    let objSiblingId: number;
    if (vm.header.version <= 3) {
      objSiblingId = vm.memory.readUInt8(objAddress + 5);
      vm.memory.writeUInt8(objSiblingId, parentAddress + 6);
    } else {
      objSiblingId = vm.memory.readUInt16BE(objAddress + 9);
      vm.memory.writeUInt16BE(objSiblingId, parentAddress + 10);
    }
  } else {
    // Find the object in the parent's child list
    let currentChildId = parentChildId;
    while (currentChildId !== 0) {
      const currentChildAddress = vm.getObjectAddress(currentChildId);

      let currentChildSiblingId: number;
      if (vm.header.version <= 3) {
        currentChildSiblingId = vm.memory.readUInt8(currentChildAddress + 5);
      } else {
        currentChildSiblingId = vm.memory.readUInt16BE(currentChildAddress + 9);
      }

      if (currentChildSiblingId === objectId) {
        let objSiblingId: number;
        if (vm.header.version <= 3) {
          objSiblingId = vm.memory.readUInt8(objAddress + 5);
          vm.memory.writeUInt8(objSiblingId, currentChildAddress + 5);
        } else {
          objSiblingId = vm.memory.readUInt16BE(objAddress + 9);
          vm.memory.writeUInt16BE(objSiblingId, currentChildAddress + 9);
        }
        break;
      }

      currentChildId = currentChildSiblingId;
    }
  }

  // Clear the removed object's parent and sibling
  if (vm.header.version <= 3) {
    vm.memory.writeUInt8(0, objAddress + 4);
    vm.memory.writeUInt8(0, objAddress + 5);
  } else {
    vm.memory.writeUInt16BE(0, objAddress + 6);
    vm.memory.writeUInt16BE(0, objAddress + 9);
  }
}

export function h_print_obj(vm: any, [objectId]: number[]) {
  if (!vm.memory || !vm.header) {
    console.error("Memory or header not loaded");
    return;
  }

  const objectAddress = vm.getObjectAddress(objectId);

  // Get property table address
  const objectEntrySize = vm.header.version <= 3 ? 9 : 14;
  const propertyTableAddr = vm.memory.readUInt16BE(
    objectAddress + objectEntrySize - 2,
  );

  // The short name is at the property table address
  const origPC = vm.pc;
  vm.pc = propertyTableAddr + 1;
  vm.print();
  vm.pc = origPC;
}

export function h_test_attr(
  vm: any,
  [objectId, attrNum]: number[],
  ctx: { branch?: (c: boolean) => void },
) {
  if (!vm.memory || !vm.header) {
    console.error("Memory or header not loaded");
    return;
  }

  const objectAddress = vm.getObjectAddress(objectId);

  const attrByteCount = vm.header.version <= 3 ? 4 : 6;
  const attrByteIndex = Math.floor(attrNum / 8);
  const attrBitIndex = 7 - (attrNum % 8);

  if (attrByteIndex >= attrByteCount) {
    console.error(`Invalid attribute number ${attrNum}`);
    return;
  }

  const attrByte = vm.memory.readUInt8(objectAddress + attrByteIndex);
  const hasAttr = ((attrByte >> attrBitIndex) & 1) === 1;
  ctx.branch?.(hasAttr);
}

export function h_set_attr(vm: any, [objectId, attrNum]: number[]) {
  if (!vm.memory || !vm.header) {
    console.error("Memory or header not loaded");
    return;
  }

  const objectAddress = vm.getObjectAddress(objectId);

  const attrByteCount = vm.header.version <= 3 ? 4 : 6;
  const attrByteIndex = Math.floor(attrNum / 8);
  const attrBitIndex = 7 - (attrNum % 8);

  if (attrByteIndex >= attrByteCount) {
    console.error(`Invalid attribute number ${attrNum}`);
    return;
  }

  const attrByte = vm.memory.readUInt8(objectAddress + attrByteIndex);
  const newByte = attrByte | (1 << attrBitIndex);
  vm.memory.writeUInt8(newByte, objectAddress + attrByteIndex);
}

export function h_clear_attr(vm: any, [objectId, attrNum]: number[]) {
  if (!vm.memory || !vm.header) {
    console.error("Memory or header not loaded");
    return;
  }

  const objectAddress = vm.getObjectAddress(objectId);

  const attrByteCount = vm.header.version <= 3 ? 4 : 6;
  const attrByteIndex = Math.floor(attrNum / 8);
  const attrBitIndex = 7 - (attrNum % 8);

  if (attrByteIndex >= attrByteCount) {
    console.error(`Invalid attribute number ${attrNum}`);
    return;
  }

  const attrByte = vm.memory.readUInt8(objectAddress + attrByteIndex);
  const newByte = attrByte & ~(1 << attrBitIndex);
  vm.memory.writeUInt8(newByte, objectAddress + attrByteIndex);
}

export function h_jin(
  vm: any,
  [obj1, obj2]: number[],
  ctx: { branch?: (c: boolean) => void },
) {
  if (!vm.memory || !vm.header) {
    console.error("Memory or header not loaded");
    return;
  }

  const obj1Address = vm.getObjectAddress(obj1);

  let parent: number;
  if (vm.header.version <= 3) {
    parent = vm.memory.readUInt8(obj1Address + 4);
  } else {
    parent = vm.memory.readUInt16BE(obj1Address + 6);
  }

  ctx.branch?.(parent === obj2);
}

export function h_insert_obj(vm: any, [objectId, destId]: number[]) {
  if (!vm.memory || !vm.header) {
    console.error("Memory or header not loaded");
    return;
  }

  const objAddress = vm.getObjectAddress(objectId);
  const destAddress = vm.getObjectAddress(destId);

  if(!vm.playerObjectNumber) {
    if(vm.lastRead && ( !vm.lastRead.startsWith('dr') ) && ( !vm.lastRead.startsWith('ta') ))
      vm.setPlayerObjectNumber(objectId);
  }

  // First, remove object from its current parent
  if (vm.header.version <= 3) {
    const oldParent = vm.memory.readUInt8(objAddress + 4);

    if (oldParent !== 0) {
      const oldParentAddress = vm.getObjectAddress(oldParent);
      const oldParentChild = vm.memory.readUInt8(oldParentAddress + 6);

      if (oldParentChild === objectId) {
        const objSibling = vm.memory.readUInt8(objAddress + 5);
        vm.memory.writeUInt8(objSibling, oldParentAddress + 6);
      } else {
        let currentObj = oldParentChild;
        while (currentObj !== 0) {
          const currentObjAddress = vm.getObjectAddress(currentObj);
          const nextSibling = vm.memory.readUInt8(currentObjAddress + 5);
          if (nextSibling === objectId) {
            const objSibling = vm.memory.readUInt8(objAddress + 5);
            vm.memory.writeUInt8(objSibling, currentObjAddress + 5);
            break;
          }
          currentObj = nextSibling;
        }
      }
    }

    // Insert as first child of destination
    const destChild = vm.memory.readUInt8(destAddress + 6);
    vm.memory.writeUInt8(destChild, objAddress + 5);
    vm.memory.writeUInt8(objectId, destAddress + 6);
    vm.memory.writeUInt8(destId, objAddress + 4);
  } else {
    const oldParent = vm.memory.readUInt16BE(objAddress + 6);

    if (oldParent !== 0) {
      const oldParentAddress = vm.getObjectAddress(oldParent);
      const oldParentChild = vm.memory.readUInt16BE(oldParentAddress + 10);

      if (oldParentChild === objectId) {
        const objSibling = vm.memory.readUInt16BE(objAddress + 8);
        vm.memory.writeUInt16BE(objSibling, oldParentAddress + 10);
      } else {
        let currentObj = oldParentChild;
        while (currentObj !== 0) {
          const currentObjAddress = vm.getObjectAddress(currentObj);
          const nextSibling = vm.memory.readUInt16BE(currentObjAddress + 8);
          if (nextSibling === objectId) {
            const objSibling = vm.memory.readUInt16BE(objAddress + 8);
            vm.memory.writeUInt16BE(objSibling, currentObjAddress + 8);
            break;
          }
          currentObj = nextSibling;
        }
      }
    }

    // Insert as first child of destination
    const destChild = vm.memory.readUInt16BE(destAddress + 10);
    vm.memory.writeUInt16BE(destChild, objAddress + 8);
    vm.memory.writeUInt16BE(objectId, destAddress + 10);
    vm.memory.writeUInt16BE(destId, objAddress + 6);
  }
}
