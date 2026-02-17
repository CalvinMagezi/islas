"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function SignInPage() {
    const router = useRouter();

    useEffect(() => {
        // Local mode: skip sign-in and go directly to app
        router.replace("/");
    }, [router]);

    return (
        <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm">Entering Local Mode...</p>
            </div>
        </div>
    );
}
