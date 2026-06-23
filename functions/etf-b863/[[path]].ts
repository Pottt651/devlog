const TARGET_ORIGIN = "https://etf-b863.pages.dev";

export const onRequest: PagesFunction = async (context) => {
  return proxyEtfB863(context.request);
};

async function proxyEtfB863(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const target = new URL(TARGET_ORIGIN);
  const suffix = url.pathname.slice("/etf-b863".length);
  target.pathname = suffix || "/";
  target.search = url.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");

  const upstream = await fetch(new Request(target.toString(), {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "manual",
  }));
  return rewriteResponse(upstream, target.pathname);
}

async function rewriteResponse(upstream: Response, targetPath: string): Promise<Response> {
  const headers = new Headers(upstream.headers);
  const type = headers.get("content-type") || "";

  if (type.includes("text/html")) {
    const html = await upstream.text();
    headers.set("content-type", "text/html; charset=utf-8");
    return new Response(html.replaceAll('"/src/', '"/etf-b863/src/'), {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  }

  if (targetPath === "/src/api.js" && type.includes("javascript")) {
    const js = await upstream.text();
    headers.set("content-type", "application/javascript; charset=utf-8");
    return new Response(js.replace('const API_BASE = "";', 'const API_BASE = "/etf-b863";'), {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
