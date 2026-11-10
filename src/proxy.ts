import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  // The supported auth route renews both the DB deadline and response cookie.
  const sessionResponse = await getAuth().handler(
    new Request(new URL("/api/auth/get-session", process.env.BETTER_AUTH_URL), {
      headers: request.headers,
    }),
  );
  if (!sessionResponse.ok)
    return new NextResponse("Authentication unavailable", { status: 503 });
  const session = await sessionResponse.json();
  const response = session
    ? NextResponse.next()
    : NextResponse.redirect(new URL("/login", process.env.BETTER_AUTH_URL));
  for (const cookie of sessionResponse.headers.getSetCookie())
    response.headers.append("set-cookie", cookie);
  response.headers.set("cache-control", "private, no-store");
  return response;
}

export const config = { matcher: ["/", "/contacts/:path*", "/groups/:path*"] };
