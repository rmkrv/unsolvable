import { notFound } from "next/navigation";
import { HomeDashboard } from "@/components/home-dashboard";

export default function HomeDesignPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <HomeDashboard
      user={{
        displayName: "Maya Kim",
        fullName: "Maya Kim",
        email: "maya@example.test",
      }}
    />
  );
}
