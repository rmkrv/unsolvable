import { auth } from "@/lib/server/auth/neon";

export const dynamic = "force-dynamic";
export const { GET, POST, PUT, DELETE, PATCH } = auth.handler();
