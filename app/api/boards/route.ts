import { GET as getStudentBoards, POST as createStudentBoard } from "@/app/api/student/boards/route";
import { deprecationHeaders } from "@/lib/server/http/route-utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return deprecated(await getStudentBoards(request), "/api/student/boards");
}

export async function POST(request: Request) {
  return deprecated(await createStudentBoard(request), "/api/student/boards");
}

function deprecated(response: Response, replacement: string) {
  for (const [key, value] of Object.entries(deprecationHeaders)) response.headers.set(key, value);
  response.headers.set("Link", `<${replacement}>; rel=\"successor-version\"`);
  return response;
}
