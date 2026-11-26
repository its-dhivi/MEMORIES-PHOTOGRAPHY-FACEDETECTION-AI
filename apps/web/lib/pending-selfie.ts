let pending: File | null = null;
export function setPendingSelfie(file: File) {
  pending = file;
}
export function takePendingSelfie() {
  const value = pending;
  pending = null;
  return value;
}
