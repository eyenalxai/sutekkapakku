export const startServer = ({ port }: { port: number }) =>
  Bun.serve({
    port,
    fetch: (request) => {
      const { pathname } = new URL(request.url)
      if (request.method === "GET" && pathname === "/health") {
        return Response.json({ status: "ok" })
      }
      return new Response("Not Found", { status: 404 })
    },
  })
