import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // Protect dashboard routes
  if (
    !user &&
    (path.startsWith("/patient") ||
      path.startsWith("/doctor") ||
      path.startsWith("/hospital") ||
      path.startsWith("/admin"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    // Fetch user role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile) {
      const role = profile.role;
      if (path.startsWith("/patient") && role !== "patient") {
        return NextResponse.redirect(
          new URL(`/${role}/dashboard`, request.url),
        );
      }
      if (
        path.startsWith("/doctor") &&
        role !== "doctor" &&
        role !== "hospital_admin"
      ) {
        return NextResponse.redirect(
          new URL(`/${role}/dashboard`, request.url),
        );
      }
      if (path.startsWith("/hospital") && role !== "hospital_admin") {
        return NextResponse.redirect(
          new URL(`/${role}/dashboard`, request.url),
        );
      }
      if (path.startsWith("/admin") && role !== "system_admin") {
        return NextResponse.redirect(
          new URL(`/${role}/dashboard`, request.url),
        );
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/patient/:path*",
    "/doctor/:path*",
    "/hospital/:path*",
    "/admin/:path*",
  ],
};
