import { Suspense } from "react";
import App from "@/components/App";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Suspense fallback={<div className="p-6">Loading plan...</div>}>
        <App />
      </Suspense>
    </main>
  );
}
