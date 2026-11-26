// Node resolve hook: "./format" -> "./format.js" (or .jsx), as Vite does.
const EXTENSIONS = [".js", ".jsx", "/index.js"];

export async function resolve(specifier, context, nextResolve) {
  const relative = specifier.startsWith("./") || specifier.startsWith("../");
  const hasExtension = /\.[cm]?[jt]sx?$|\.json$/.test(specifier);
  if (!relative || hasExtension) return nextResolve(specifier, context);
  for (const extension of EXTENSIONS) {
    try {
      return await nextResolve(specifier + extension, context);
    } catch {
      // try the next extension
    }
  }
  return nextResolve(specifier, context);
}
