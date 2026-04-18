export type Fb2PointLocation = {
  kind: 'point';
  chapterId: string;
  blockId: string | null;
};

export type Fb2RangeLocation = {
  kind: 'range';
  chapterId: string;
  startBlockId: string;
  startOffset: number;
  endBlockId: string;
  endOffset: number;
};

export type Fb2Location = Fb2PointLocation | Fb2RangeLocation;

const FB2_POINT_PREFIX = 'fb2-point';
const FB2_RANGE_PREFIX = 'fb2-range';

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

export function serializeFb2PointLocation(location: {
  chapterId: string;
  blockId?: string | null;
}): string {
  const chapterId = normalizePart(location.chapterId) ?? 'fb2-chapter-0';
  const blockId = normalizePart(location.blockId) ?? '';
  return [FB2_POINT_PREFIX, encodePart(chapterId), encodePart(blockId)].join('|');
}

export function serializeFb2RangeLocation(location: {
  chapterId: string;
  startBlockId: string;
  startOffset: number;
  endBlockId: string;
  endOffset: number;
}): string {
  const chapterId = normalizePart(location.chapterId) ?? 'fb2-chapter-0';
  const startBlockId = normalizePart(location.startBlockId) ?? '';
  const endBlockId = normalizePart(location.endBlockId) ?? startBlockId;
  return [
    FB2_RANGE_PREFIX,
    encodePart(chapterId),
    encodePart(startBlockId),
    String(normalizeOffset(location.startOffset)),
    encodePart(endBlockId),
    String(normalizeOffset(location.endOffset))
  ].join('|');
}

export function parseFb2Location(value: string | null | undefined): Fb2Location | null {
  const normalized = normalizePart(value);
  if (!normalized) {
    return null;
  }

  const parts = normalized.split('|');
  if (parts[0] === FB2_POINT_PREFIX) {
    const chapterId = decodePart(parts[1]);
    const blockId = decodePart(parts[2]);
    if (!chapterId) {
      return null;
    }
    return {
      kind: 'point',
      chapterId,
      blockId
    };
  }

  if (parts[0] === FB2_RANGE_PREFIX) {
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
      chapterId,
      startBlockId,
      startOffset: normalizeOffset(startOffset),
      endBlockId,
      endOffset: normalizeOffset(endOffset)
    };
  }

  return null;
}

export function getFb2PointLocationKey(value: string | null | undefined): string | null {
  const parsed = parseFb2Location(value);
  if (!parsed) {
    return null;
  }
  if (parsed.kind === 'point') {
    return `${parsed.chapterId}:${parsed.blockId ?? ''}`;
  }
  return `${parsed.chapterId}:${parsed.startBlockId}`;
}

export function isSameFb2PointLocation(current: string | null | undefined, saved: string | null | undefined): boolean {
  const currentKey = getFb2PointLocationKey(current);
  const savedKey = getFb2PointLocationKey(saved);
  if (!currentKey || !savedKey) {
    return false;
  }
  return currentKey === savedKey;
}

