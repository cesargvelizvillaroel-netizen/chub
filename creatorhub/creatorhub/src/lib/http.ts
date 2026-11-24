import { NextResponse } from "next/server";

export const unauthorized = () => NextResponse.json({ error: "No autenticado" }, { status: 401 });
export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const redirectUriFor = (slug: string) => `${appUrl()}/api/connect/${slug}/callback`;
