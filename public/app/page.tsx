import { redirect } from "next/navigation";

export default function Home() {
  // Redirect to login page by default
  redirect("/auth/login");
}
