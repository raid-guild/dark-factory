export function isBrowserOpenableArtifactUri(uri: string) {
  return /^https?:\/\//.test(uri);
}
