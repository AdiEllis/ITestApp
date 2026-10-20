import { requireUser } from "@/lib/auth";
import { Alert } from "@/components/ui/alert";
import { ChangePasswordForm } from "./form";

export const metadata = { title: "שינוי סיסמה" };

export default async function ChangePasswordPage() {
  const user = await requireUser();
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">שינוי סיסמה</h1>
      {user.mustChangePassword && (
        <Alert className="mt-4" tone="info" title="יש לבחור סיסמה אישית">
          החשבון נוצר עם סיסמה זמנית. בחרו סיסמה חדשה כדי להמשיך.
        </Alert>
      )}
      <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
