export const onRequest: PagesFunction = async (context) => {
  const target = new URL("/etf-b863", context.request.url);
  return new Response(null, {
    status: 302,
    headers: {
      Location: target.toString(),
      "Cache-Control": "no-store",
    },
  });
};
