import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function StudentRootLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["STUDENT"]);
  if (user.mustChangePassword) redirect("/change-password");
  return children;
}
