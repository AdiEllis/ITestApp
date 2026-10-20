import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminShell } from "./shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["ADMIN"]);
  if (user.mustChangePassword) redirect("/change-password");
  return <AdminShell name={user.name}>{children}</AdminShell>;
}
