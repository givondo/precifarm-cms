/**
 * Minimal ESM loader hooks for node:test.
 * Transpiles .ts/.tsx with the repo's own TypeScript compiler and resolves the
 * "@/..." path alias plus extensionless relative imports, matching tsconfig.json.
 */
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = path.join(ROOT, "src");
const EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"];

async function isFile(p) {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

async function resolveTsPath(base) {
  if (/\.(ts|tsx|mjs|js|json)$/.test(base) && (await isFile(base))) return base;
  for (const ext of EXTENSIONS) {
    if (await isFile(base + ext)) return base + ext;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  let candidate = null;
  if (specifier.startsWith("@/")) {
    candidate = path.join(SRC, specifier.slice(2));
  } else if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL?.startsWith("file:")
  ) {
    candidate = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }
  if (candidate) {
    const found = await resolveTsPath(candidate);
    if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
  }
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    // Packages without an "exports" map (for example next/server) need the .js suffix under ESM.
    const isBareSubpath = !specifier.startsWith(".") && !specifier.startsWith("/") && specifier.includes("/");
    if (err?.code === "ERR_MODULE_NOT_FOUND" && isBareSubpath && !/\.[cm]?js$/.test(specifier)) {
      return nextResolve(`${specifier}.js`, context);
    }
    throw err;
  }
}

export async function load(url, context, nextLoad) {
  if (url.startsWith("file:") && /\.(ts|tsx)$/.test(url)) {
    const filename = fileURLToPath(url);
    const source = await readFile(filename, "utf8");
    const { outputText } = ts.transpileModule(source, {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
        sourceMap: false,
      },
    });
    return { format: "module", source: outputText, shortCircuit: true };
  }
  return nextLoad(url, context);
}
