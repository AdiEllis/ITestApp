import { getCurrentUser } from "@/lib/auth";
import { getOwnAssignment } from "@/lib/authz";
import { errorResponse, json } from "@/lib/http";
import { buildSebConfig } from "@/lib/seb";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";

/** Downloads the Safe Exam Browser config file that starts this assignment's classroom exam. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: "יש להתחבר מחדש" }, 401);
    const { id } = await params;
    const a = await getOwnAssignment(user, id);
    if (!a.requireSeb || !a.sebKey) return json({ error: "המשימה לא מוגדרת כמבחן במחשב נעול" }, 400);
    const body = buildSebConfig(a, { googleSignIn: env.googleEnabled });
    await audit(user.id, "assignment.seb.download", { type: "Assignment", id });
    return new Response(body, {
      headers: {
        "Content-Type": "application/seb",
        // ASCII name: browsers replace a Hebrew (right-to-left) download name with "download".
        "Content-Disposition": `attachment; filename="oralprep-exam-${id.slice(-6)}.seb"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
