export const onRequest: PagesFunction = async () => {
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/auth/login",
      "Set-Cookie":
        "pott_auth=; Domain=.pott1587.xyz; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    },
  });
};
