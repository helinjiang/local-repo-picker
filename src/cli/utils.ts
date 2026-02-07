export function readArgValue(args: string[], key: string): string {
  const index = args.indexOf(key);
  if (index >= 0 && index + 1 < args.length) {
    return args[index + 1];
  }
  return '';
}
