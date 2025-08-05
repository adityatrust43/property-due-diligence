'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSimpleAuth } from '../hooks/useSimpleAuth';
import { UserCircleIcon } from './property/icons';

const UserMenu: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { logout } = useSimpleAuth();
    const router = useRouter();

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    return (
        <div className="relative">
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center space-x-2">
                <UserCircleIcon className="w-8 h-8 text-white" />
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg py-1 z-10">
                    <div className="px-4 py-2 text-sm text-gray-400">
                        Signed in as <span className="font-medium text-white">admin</span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                    >
                        Logout
                    </button>
                </div>
            )}
        </div>
    );
};

export default UserMenu;
