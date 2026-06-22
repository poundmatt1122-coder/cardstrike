import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DashNav from "./DashNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/");

  // Check onboarding completion.
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { dateOfBirth: true, isMinor: true, parentApproved: true },
  });

  // New user — onboarding not done yet.
  if (!user || !user.dateOfBirth) redirect("/onboarding");

  const showMinorBanner = user.isMinor && !user.parentApproved;

  return (
    <div className="flex flex-1 flex-col">
      {showMinorBanner && (
        <div className="bg-suns-orange/20 border-b border-suns-orange/40 px-6 py-2.5 text-center text-sm text-suns-orange">
          ⏳ Your account is pending parent approval. Check your parent&apos;s email to unlock full access.
        </div>
      )}
      <DashNav />
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
