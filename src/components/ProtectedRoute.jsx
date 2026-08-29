import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";


export default function ProtectedRoute({ children }) {

  const {
    isAuthenticated,
    isLoadingAuth
  } = useAuth();


  if (isLoadingAuth) {

    return (
      <div className="flex min-h-screen items-center justify-center">
        加载中...
      </div>
    );

  }


  if (!isAuthenticated) {

    return (
      <Navigate
        to="/login"
        replace
      />
    );

  }


  return children;

}