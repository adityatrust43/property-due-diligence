'use client';

import { useAuth } from '../hooks/useAuth';
import { signOut } from 'aws-amplify/auth';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

export default function Header() {
  const { user } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <header className="w-full max-w-5xl mb-10 flex justify-center items-center relative">
      <h1 className="text-4xl font-bold text-blue-400 tracking-tight">Property Document Analyzer</h1>
      {user && (
        <div className="absolute right-0">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <img
                src={user.attributes?.picture || `https://ui-avatars.com/api/?name=${user.attributes?.email}`}
                alt="User profile"
                className="w-10 h-10 rounded-full cursor-pointer"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>{user.attributes?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </header>
  );
}
