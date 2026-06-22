import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-suns-purple-deep px-4 py-16">
      <SignIn />
    </main>
  );
}
