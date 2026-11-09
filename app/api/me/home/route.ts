import { GET as getStudentHome } from "@/app/api/student/home/route";
import { deprecationHeaders } from "@/lib/server/http/route-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const response = await getStudentHome();
  for (const [key, value] of Object.entries(deprecationHeaders)) response.headers.set(key, value);
  response.headers.set("Link", "</api/student/home>; rel=\"successor-version\"");
  return response;
}
