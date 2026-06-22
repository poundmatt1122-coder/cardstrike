import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import OnboardingClient from "./OnboardingClient";

export const metadata = { title: "Welcome to CardStrike" };

export default async function OnboardingPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/");

  // Already onboarded?
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { dateOfBirth: true, phoneVerified: true },
  });
  if (user?.dateOfBirth && user.phoneVerified) redirect("/dashboard");

  return (
    <main className="flex flex-1 items-center justify-center bg-suns-purple-deep px-4 py-16">
      <OnboardingClient skipToPhone={!!user?.dateOfBirth} />
    </main>
  );
}
