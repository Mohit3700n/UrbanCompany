
import { useEffect, useState } from "react";
import api from "../api/axios";
import { AuthContext } from "./AuthContext";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(() =>
    Boolean(localStorage.getItem("access_token"))
  );

  // Restore existing login session
  useEffect(() => {
  const token = localStorage.getItem("access_token");

  if (!token) {
    return;
  }

  api
    .get("/auth/me")
    .then((response) => {
      setUser(response.data);
    })
    .catch(() => {
      localStorage.removeItem("access_token");
      setUser(null);
    })
    .finally(() => {
      setLoading(false);
    });
}, []);

  // Login
  const login = async (email, password) => {
    const formData = new URLSearchParams();

    formData.append("username", email);
    formData.append("password", password);

    const response = await api.post("/auth/login", formData, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    localStorage.setItem("access_token", response.data.access_token);

    const userResponse = await api.get("/auth/me");

    setUser(userResponse.data);

    return userResponse.data;
  };

  // Register
  const register = async (fullName, email, password, role) => {
    await api.post("/auth/register", {
      full_name: fullName,
      email,
      password,
      role,
    });

    return login(email, password);
  };

  // Logout
  const logout = () => {
    localStorage.removeItem("access_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
