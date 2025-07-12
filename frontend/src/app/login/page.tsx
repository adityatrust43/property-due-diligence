'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    // Simple client-side validation for demonstration
    if (username === 'user' && password === 'password') {
      // In a real application, you would handle authentication (e.g., API call)
      // and store a token/session.
      router.push('/home'); // Redirect to the new home page
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Login</h2>
        <form onSubmit={handleLogin}>
          {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="username">
              Username
            </label>
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              id="username"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="password">
              Password
            </label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              id="password"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Login
          </button>
          <p className="text-center text-gray-600 text-sm mt-4">
            Forgot password? <a href="#" className="text-blue-600 hover:text-blue-800">Click here</a>
          </p>
        </form>
      </div>
    </div>
  );
}
