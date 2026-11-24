import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";

export default function RegisterPage() {
  if (process.env.ALLOW_REGISTRATION === "false") redirect("/login");
  return <AuthForm mode="register" />;
}
