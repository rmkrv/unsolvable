import { notFound } from "next/navigation";
import { HomeDashboard } from "@/app/home/page";

export default function HomeDesignPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <HomeDashboard
      user={{
        userId: "design-preview",
        displayName: "Maya Kim",
        fullName: "Maya Kim",
        email: "maya@example.test",
      }}
    />
  );
}
