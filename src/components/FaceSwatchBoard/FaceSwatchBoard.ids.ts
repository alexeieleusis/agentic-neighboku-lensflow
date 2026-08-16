export type FaceTileId = string & { readonly brand: unique symbol };

export function createFaceTileId(raw: string): FaceTileId {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new TypeError("FaceTileId must not be empty");
  }
  // eslint-disable-next-line lensflow/no-direct-brand-cast
  return trimmed as FaceTileId;
}
