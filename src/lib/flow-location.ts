export type FlowLocationNamespace = 'fb2' | 'txt';

export type FlowPointLocation = {
  kind: 'point';
  namespace: FlowLocationNamespace;
  chapterId: string;
  blockId: string | null;
};

export type FlowRangeLocation = {
  kind: 'range';
  namespace: FlowLocationNamespace;
  chapterId: string;
  startBlockId: string;
  startOffset: number;
  endBlockId: string;
  endOffset: number;
};

export type FlowLocation = FlowPointLocation | FlowRangeLocation;
export type Fb2PointLocation = FlowPointLocation;
export type Fb2RangeLocation = FlowRangeLocation;
export type Fb2Location = FlowLocation;

const POINT_PREFIX_BY_NAMESPACE: Record<FlowLocationNamespace, string> = {
  fb2: 'fb2-point',
  txt: 'txt-point'
};

const RANGE_PREFIX_BY_NAMESPACE: Record<FlowLocationNamespace, string> = {
  fb2: 'fb2-range',
  txt: 'txt-range'
};

function normalizePart(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function encodePart(value: string): string {
  return encodeURIComponent(value);
}

function decodePart(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  try {
    const decoded = decodeURIComponent(value);
    return normalizePart(decoded);
  } catch {
    return null;
  }
}

function normalizeOffset(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

export function serializeFlowPointLocation(
  namespace: FlowLocationNamespace,
  location: {
    chapterId: string;
    blockId?: string | null;
  }
): string {
  const chapterId = normalizePart(location.chapterId) ?? `${namespace}-chapter-0`;
  const blockId = normalizePart(location.blockId) ?? '';
  return [POINT_PREFIX_BY_NAMESPACE[namespace], encodePart(chapterId), encodePart(blockId)].join('|');
}

export function serializeFlowRangeLocation(
  namespace: FlowLocationNamespace,
  location: {
    chapterId: string;
    startBlockId: string;
    startOffset: number;
    endBlockId: string;
    endOffset: number;
  }
): string {
  const chapterId = normalizePart(location.chapterId) ?? `${namespace}-chapter-0`;
  const startBlockId = normalizePart(location.startBlockId) ?? '';
  const endBlockId = normalizePart(location.endBlockId) ?? startBlockId;
  return [
    RANGE_PREFIX_BY_NAMESPACE[namespace],
    encodePart(chapterId),
    encodePart(startBlockId),
    String(normalizeOffset(location.startOffset)),
    encodePart(endBlockId),
    String(normalizeOffset(location.endOffset))
  ].join('|');
}

function getNamespaceByPrefix(prefix: string): { namespace: FlowLocationNamespace; kind: 'point' | 'range' } | null {
  for (const namespace of Object.keys(POINT_PREFIX_BY_NAMESPACE) as FlowLocationNamespace[]) {
    if (POINT_PREFIX_BY_NAMESPACE[namespace] === prefix) {
      return { namespace, kind: 'point' };
    }
    if (RANGE_PREFIX_BY_NAMESPACE[namespace] === prefix) {
      return { namespace, kind: 'range' };
    }
  }
  return null;
}

export function parseFlowLocation(value: string | null | undefined): FlowLocation | null {
  const normalized = normalizePart(value);
  if (!normalized) {
    return null;
  }

  const parts = normalized.split('|');
  const prefix = getNamespaceByPrefix(parts[0] ?? '');
  if (!prefix) {
    return null;
  }

  if (prefix.kind === 'point') {
    const chapterId = decodePart(parts[1]);
    const blockId = decodePart(parts[2]);
    if (!chapterId) {
      return null;
    }
    return {
      kind: 'point',
      namespace: prefix.namespace,
      chapterId,
      blockId
    };
  }

  const chapterId = decodePart(parts[1]);
  const startBlockId = decodePart(parts[2]);
  const startOffset = Number(parts[3]);
  const endBlockId = decodePart(parts[4]);
  const endOffset = Number(parts[5]);
  if (!chapterId || !startBlockId || !endBlockId) {
    return null;
  }
  return {
    kind: 'range',
    namespace: prefix.namespace,
    chapterId,
    startBlockId,
    startOffset: normalizeOffset(startOffset),
    endBlockId,
    endOffset: normalizeOffset(endOffset)
  };
}

export function getFlowPointLocationKey(value: string | null | undefined): string | null {
  const parsed = parseFlowLocation(value);
  if (!parsed) {
    return null;
  }
  if (parsed.kind === 'point') {
    return `${parsed.namespace}:${parsed.chapterId}:${parsed.blockId ?? ''}`;
  }
  return `${parsed.namespace}:${parsed.chapterId}:${parsed.startBlockId}`;
}

export function isSameFlowPointLocation(current: string | null | undefined, saved: string | null | undefined): boolean {
  const currentKey = getFlowPointLocationKey(current);
  const savedKey = getFlowPointLocationKey(saved);
  if (!currentKey || !savedKey) {
    return false;
  }
  return currentKey === savedKey;
}

export function serializeFb2PointLocation(location: {
  chapterId: string;
  blockId?: string | null;
}): string {
  return serializeFlowPointLocation('fb2', location);
}

export function serializeFb2RangeLocation(location: {
  chapterId: string;
  startBlockId: string;
  startOffset: number;
  endBlockId: string;
  endOffset: number;
}): string {
  return serializeFlowRangeLocation('fb2', location);
}

export function parseFb2Location(value: string | null | undefined): Fb2Location | null {
  const parsed = parseFlowLocation(value);
  return parsed?.namespace === 'fb2' ? parsed : null;
}

export function getFb2PointLocationKey(value: string | null | undefined): string | null {
  return getFlowPointLocationKey(value);
}

export function isSameFb2PointLocation(current: string | null | undefined, saved: string | null | undefined): boolean {
  return isSameFlowPointLocation(current, saved);
}

export function serializeTxtPointLocation(location: {
  chapterId: string;
  blockId?: string | null;
}): string {
  return serializeFlowPointLocation('txt', location);
}

export function serializeTxtRangeLocation(location: {
  chapterId: string;
  startBlockId: string;
  startOffset: number;
  endBlockId: string;
  endOffset: number;
}): string {
  return serializeFlowRangeLocation('txt', location);
}

export function parseTxtLocation(value: string | null | undefined): FlowLocation | null {
  const parsed = parseFlowLocation(value);
  return parsed?.namespace === 'txt' ? parsed : null;
}

export function isSameTxtPointLocation(current: string | null | undefined, saved: string | null | undefined): boolean {
  return isSameFlowPointLocation(current, saved);
}
