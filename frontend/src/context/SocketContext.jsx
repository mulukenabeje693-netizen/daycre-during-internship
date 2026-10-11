import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  // Read token at component level so it is in scope for the dependency array
  const { user, token } = useAuth();

  useEffect(() => {
    // Only connect if we have a logged-in user with a valid token
    if (user && token) {
      // Connect through the Vite dev proxy (same origin) so socket.io
      // traffic goes via port 3000 → proxied to 5000.
      // In production VITE_API_BASE_URL points to the real backend.
      const isDev = import.meta.env.DEV;
      const backendURL = isDev
        ? window.location.origin          // http://localhost:3000 — proxied by Vite
        : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000');

      const newSocket = io(backendURL, {
        withCredentials: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      setSocket(newSocket);

      newSocket.on('connect', () => {
        // Register the user with the server
        newSocket.emit('register', user._id);
      });

      return () => {
        newSocket.disconnect();
      };
    } else {
      // Disconnect if user logs out
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]); // Re-run when user or token changes

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};
