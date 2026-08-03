import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

rmSync("dist", { recursive: true, force: true });
cpSync("frontend/dist", "dist", { recursive: true });
cpSync("frontend/dist", "dist/client", { recursive: true });
cpSync("frontend/dist", "dist/public", { recursive: true });

mkdirSync("dist/.openai", { recursive: true });
writeFileSync(
  "dist/.openai/hosting.json",
  `${JSON.stringify({ project_id: "appgprj_6a70b2534e78819182085f76dd2dd272" }, null, 2)}\n`,
);

mkdirSync("dist/server", { recursive: true });

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function collectFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    return statSync(fullPath).isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
}

const embeddedFiles = Object.fromEntries(
  collectFiles("frontend/dist").map((filePath) => {
    const route = `/${relative("frontend/dist", filePath).split(sep).join("/")}`;
    const ext = extname(filePath);
    return [
      route,
      {
        contentType: contentTypes[ext] ?? "application/octet-stream",
        body: readFileSync(filePath).toString("base64"),
      },
    ];
  }),
);

writeFileSync(
  "dist/server/index.js",
  `const files = ${JSON.stringify(embeddedFiles)};

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function createResponse(file, request) {
  return new Response(request.method === "HEAD" ? null : decodeBase64(file.body), {
    headers: {
      "content-type": file.contentType,
      "cache-control": file.contentType.startsWith("text/html")
        ? "no-cache"
        : "public, max-age=31536000, immutable",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = files[path];

    if (file) {
      return createResponse(file, request);
    }

    if (!path.startsWith("/assets/")) {
      return createResponse(files["/index.html"], request);
    }

    return new Response("Not found", { status: 404 });
  },
};
`,
);
