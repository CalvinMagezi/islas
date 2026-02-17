"use client";

import { useQuery } from "convex/react";
import { api } from "@repo/convex";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "lucide-react";

export function UserButton() {
    const user = useQuery(api.functions.users.viewer);

    // In local mode, we might not have a user object from the database yet
    // but we can show a placeholder for the local user.
    const displayName = user?.name ?? "Local User";
    const displayEmail = user?.email ?? "local@islas.internal";

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="outline-none focus:ring-0">
                    <Avatar className="h-8 w-8 border border-white/10 transition hover:opacity-80">
                        <AvatarImage src={user?.image} alt={displayName} />
                        <AvatarFallback className="bg-blue-600 text-white text-xs">
                            {displayName[0] ?? <User className="h-4 w-4" />}
                        </AvatarFallback>
                    </Avatar>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 border-white/10 bg-black/90 backdrop-blur-xl">
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium text-white">{displayName}</p>
                        <p className="text-xs text-white/50">{displayEmail}</p>
                    </div>
                </DropdownMenuLabel>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
