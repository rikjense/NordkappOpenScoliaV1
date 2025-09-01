export function maskToken(token?: string) {
  if (!token) return undefined;
  if (token.length <= 6) return token.replace(/./g, "•");
  return `${token.slice(0, 4)}…${token.slice(-2)}`;
}
