import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
cpSync("frontend/dist", "dist", { recursive: true });
cpSync("frontend/dist", "dist/public", { recursive: true });

mkdirSync("dist/.openai", { recursive: true });
writeFileSync(
  "dist/.openai/hosting.json",
  `${JSON.stringify({ project_id: "appgprj_6a70b2534e78819182085f76dd2dd272" }, null, 2)}\n`,
);

mkdirSync("dist/server", { recursive: true });
writeFileSync(
  "dist/server/index.js",
  `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const response = await env.ASSETS.fetch(request);

    if (response.status !== 404 || url.pathname.startsWith("/assets/")) {
      return response;
    }

    return env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
  },
};
`,
);
