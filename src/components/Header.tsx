'use client';

import { useAuth } from '../hooks/useAuth';
import { getAuth, signOut } from 'firebase/auth';
import { app } from '../lib/firebase';
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
  const auth = getAuth(app);
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
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
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`}
                alt="User profile"
                className="w-10 h-10 rounded-full cursor-pointer"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
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
